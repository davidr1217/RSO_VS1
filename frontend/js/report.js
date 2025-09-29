// frontend/js/report.js
import { supabase } from './supabase.js'

function initializeApp() {
    const form = document.getElementById('report-form');
    const preview = document.getElementById('preview');
    const evidenciaInput = document.getElementById('evidencia');

    // Preview de imagen
    evidenciaInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) { 
            preview.style.display = 'none'; 
            return; 
        }
        
        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
            alert('⚠️ Por favor, seleccione solo archivos de imagen.');
            evidenciaInput.value = '';
            preview.style.display = 'none';
            return;
        }
        
        // Validar tamaño (máximo 2MB para Base64)
        if (file.size > 2 * 1024 * 1024) {
            alert('⚠️ La imagen es demasiado grande. Máximo 2MB permitido.');
            evidenciaInput.value = '';
            preview.style.display = 'none';
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            preview.src = ev.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });

    // Manejo del formulario
    form.addEventListener('submit', handleFormSubmit);
}

function generarCandidato() {
    const prefix = 'PSJ';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let suf = '';
    for (let i = 0; i < 7; i++) {
        suf += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + suf;
}

async function generarCodigoUnico(maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        const codigo = generarCandidato();
        try {
            const { data, error } = await supabase
                .from('denuncias')
                .select('id')
                .eq('codigo_unico', codigo)
                .limit(1);

            if (error) {
                console.warn('Error comprobando código:', error);
                continue;
            }
            if (!data || data.length === 0) return codigo;
        } catch (err) {
            console.warn('Error en verificación de código:', err);
        }
    }
    throw new Error('No se pudo generar un código único');
}

// Convertir archivo a Base64
function archivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(archivo);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('🚀 Iniciando envío de formulario...');

    const form = document.getElementById('report-form');
    const ubicacion = document.getElementById('ubicacion').value.trim();
    const categoria = document.getElementById('categoria').value;
    const descripcion = document.getElementById('descripcion').value.trim();
    const evidenciaFile = document.getElementById('evidencia').files[0];
    const successMessage = document.getElementById('success-message');
    const codeDisplay = document.getElementById('code-display');

    // Validaciones básicas
    if (!ubicacion || !categoria || !descripcion || !evidenciaFile) {
        alert('⚠️ Complete todos los campos obligatorios.');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    let denunciaId = null;

    try {
        // Paso 1: Generar código único
        console.log('1. Generando código único...');
        const codigoUnico = await generarCodigoUnico();
        console.log('✅ Código generado:', codigoUnico);

        // Paso 2: Convertir imagen a Base64
        console.log('2. Convirtiendo imagen a Base64...');
        const imagenBase64 = await archivoABase64(evidenciaFile);
        console.log('✅ Imagen convertida (tamaño):', imagenBase64.length, 'caracteres');

        // Paso 3: Insertar denuncia
        console.log('3. Insertando denuncia...');
        const { data: insertedDenuncia, error: insertError } = await supabase
            .from('denuncias')
            .insert([{
                codigo_unico: codigoUnico,
                descripcion: descripcion,
                categoria: categoria,
                ubicacion: ubicacion,
                estado: 'Pendiente',
                latitud: null,
                longitud: null,
                creado_en: new Date().toISOString()
            }])
            .select()
            .single();

        if (insertError) {
            console.error('❌ Error insertando denuncia:', insertError);
            throw insertError;
        }

        denunciaId = insertedDenuncia.id;
        console.log('✅ Denuncia insertada ID:', denunciaId);

        // Paso 4: Insertar evidencia como Base64 en la BD
        console.log('4. Guardando evidencia en Base64...');
        const { error: evidenciaError } = await supabase
            .from('evidencias')
            .insert([{
                denuncia_id: denunciaId,
                usuario_id: null,
                archivo_url: imagenBase64, // Guardamos el Base64 directamente
                tipo: evidenciaFile.type,
                nombre_archivo: evidenciaFile.name,
                subido_en: new Date().toISOString()
            }]);

        if (evidenciaError) {
            console.error('❌ Error guardando evidencia:', evidenciaError);
            throw evidenciaError;
        }
        console.log('✅ Evidencia guardada en Base64');

        // Paso 5: Registrar historial
        console.log('5. Registrando historial...');
        try {
            const { error: historialError } = await supabase
                .from('historial_estados')
                .insert([{
                    denuncia_id: denunciaId,
                    estado_anterior: null,
                    estado_nuevo: 'Pendiente',
                    cambiado_por: null,
                    fecha_cambio: new Date().toISOString()
                }]);

            if (historialError) {
                console.warn('⚠️ Error en historial (no crítico):', historialError);
            } else {
                console.log('✅ Historial registrado');
            }
        } catch (historialErr) {
            console.warn('⚠️ Error no crítico en historial:', historialErr);
        }

        // ÉXITO: Mostrar mensaje de éxito
        console.log('🎉 Proceso completado exitosamente');
        codeDisplay.textContent = codigoUnico;
        successMessage.style.display = 'block';
        form.style.display = 'none';

    } catch (error) {
        console.error('❌ ERROR EN EL PROCESO:', error);
        
        // Limpiar en caso de error
        if (denunciaId) {
            try {
                await supabase.from('denuncias').delete().eq('id', denunciaId);
                console.log('🗑️ Denuncia eliminada por error');
            } catch (deleteError) {
                console.error('Error eliminando denuncia:', deleteError);
            }
        }

        // Mensaje de error amigable
        let mensajeUsuario = 'Error al enviar el reporte. ';
        
        if (error.message.includes('network') || error.message.includes('fetch')) {
            mensajeUsuario += 'Error de conexión. ';
        } else if (error.message.includes('unique') || error.message.includes('duplicate')) {
            mensajeUsuario += 'Error en el sistema. ';
        } else if (error.message.includes('size') || error.message.includes('large')) {
            mensajeUsuario += 'La imagen es demasiado grande. ';
        }
        
        mensajeUsuario += 'Por favor, intente nuevamente.';
        
        alert(`❌ ${mensajeUsuario}\n\nDetalle: ${error.message}`);
        
    } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Función global para resetear formulario
window.resetForm = function() {
    const form = document.getElementById('report-form');
    const preview = document.getElementById('preview');
    const successMessage = document.getElementById('success-message');
    
    form.reset();
    preview.style.display = 'none';
    successMessage.style.display = 'none';
    form.style.display = 'block';
    
    console.log('🔄 Formulario reseteado');
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ report.js cargado correctamente');
    initializeApp();
});

// Función para verificar conexión
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase
            .from('denuncias')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        console.log('✅ Conexión a Supabase: OK');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

// Exportar para testing
export { testSupabaseConnection };