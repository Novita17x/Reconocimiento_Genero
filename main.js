// Variables globales
let recognition; // Objeto para reconocimiento de voz
let synthesis; // Objeto para síntesis de voz
let audioContext; // Contexto de audio web
let analyser; // Analizador de frecuencias
let microphone; // Fuente de micrófono
let dataArray; // Array para datos de frecuencia
let isListening = false; // Estado de escucha activa
let lastSpokenText = ""; // Último texto reconocido
let detectedGender = "neutral"; // Género detectado por voz
let voices = []; // Array de voces disponibles
let frequencyData = []; // Datos de frecuencia acumulados
let animationId; // ID de animación para análisis

// Rutas de las imágenes - CAMBIAR ESTAS RUTAS POR TUS IMÁGENES
const imageUrls = { // URLs de imágenes por género
    male:"img/male.png",
    female: "img/femenino.png",
    neutral: "img/robot.png"
};

// Inicialización
function initializeGame() { // Función principal de inicialización
    initSpeechRecognition(); // Configura reconocimiento de voz
    initSpeechSynthesis(); // Configura síntesis de voz
    initAudioContext(); // Configura contexto de audio
}

// Configuración de reconocimiento de voz
function initSpeechRecognition() { // Configurar API de reconocimiento
    if ('webkitSpeechRecognition' in window) { // Verifica soporte en Chrome
        recognition = new webkitSpeechRecognition(); // Crea instancia webkit
    } else if ('SpeechRecognition' in window) { // Verifica soporte estándar
        recognition = new SpeechRecognition(); // Crea instancia estándar
    } else { // No hay soporte
        updateStatus('Tu navegador no soporta reconocimiento de voz'); // Mensaje de error
        return false; // Retorna fallo
    }

    recognition.continuous = false; // No reconocimiento continuo
    recognition.interimResults = false; // No resultados parciales
    recognition.lang = 'es-ES'; // Idioma español

    recognition.onstart = function() { // Evento al iniciar reconocimiento
        isListening = true; // Marca como escuchando
        updateStatus("Escuchando y analizando tu voz..."); // Actualiza estado
        document.getElementById('listenBtn').classList.add('recording'); // Añade clase visual
        document.getElementById('character').classList.add('listening'); // Añade clase al personaje
        startFrequencyAnalysis(); // Inicia análisis de frecuencia
    };

    recognition.onresult = function(event) { // Evento al obtener resultado
        const transcript = event.results[0][0].transcript; // Extrae texto transcrito
        lastSpokenText = transcript; // Guarda último texto
        
        updateUI(transcript, detectedGender); // Actualiza interfaz
        document.getElementById('repeatBtn').disabled = false; // Habilita botón repetir
    };

    recognition.onerror = function(event) { // Evento de error
        console.error('Error de reconocimiento:', event.error); // Log del error
        updateStatus("Error: " + event.error); // Muestra error en UI
        resetListening(); // Resetea estado de escucha
    };

    recognition.onend = function() { // Evento al terminar reconocimiento
        resetListening(); // Resetea estado de escucha
    };

    return true; // Retorna éxito
}

// Configuración de síntesis de voz
function initSpeechSynthesis() { // Configurar síntesis de voz
    synthesis = window.speechSynthesis; // Obtiene API de síntesis
    
    if (synthesis.onvoiceschanged !== undefined) { // Si soporta evento de cambio
        synthesis.onvoiceschanged = loadVoices; // Asigna función de carga
    }
    loadVoices(); // Carga voces inicialmente
}

// Cargar voces disponibles
function loadVoices() { // Función para cargar voces
    voices = synthesis.getVoices(); // Obtiene todas las voces
    console.log('Voces disponibles:', voices.length); // Log cantidad de voces
}

// Inicializar contexto de audio
function initAudioContext() { // Configurar análisis de audio
    try { // Intenta crear contexto
        audioContext = new (window.AudioContext || window.webkitAudioContext)(); // Crea contexto compatible
        analyser = audioContext.createAnalyser(); // Crea analizador
        analyser.fftSize = 2048; // Tamaño FFT para análisis
        
        const bufferLength = analyser.frequencyBinCount; // Obtiene tamaño del buffer
        dataArray = new Uint8Array(bufferLength); // Crea array para datos
        
        console.log('Contexto de audio inicializado'); // Log de éxito
    } catch (error) { // Maneja errores
        console.error('Error inicializando audio:', error); // Log del error
        updateStatus('Análisis de frecuencia limitado'); // Mensaje de limitación
    }
}

// Iniciar análisis de frecuencia
async function startFrequencyAnalysis() { // Función asíncrona para análisis
    if (!audioContext) return; // Sale si no hay contexto
    
    try { // Intenta acceder al micrófono
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // Obtiene stream de audio
        microphone = audioContext.createMediaStreamSource(stream); // Crea fuente de stream
        microphone.connect(analyser); // Conecta micrófono al analizador
        
        frequencyData = []; // Limpia datos previos
        analyzeFrequency(); // Inicia análisis
        
    } catch (error) { // Maneja errores de acceso
        console.error('Error accediendo al micrófono:', error); // Log del error
    }
}

// Analizar frecuencia en tiempo real
function analyzeFrequency() { // Función de análisis continuo
    if (!isListening || !analyser) return; // Sale si no está escuchando
    
    analyser.getByteFrequencyData(dataArray); // Obtiene datos de frecuencia
    
    const fundamentalFreq = calculateFundamentalFrequency(); // Calcula frecuencia fundamental
    
    if (fundamentalFreq > 0) { // Si hay frecuencia válida
        frequencyData.push(fundamentalFreq); // Añade a array de datos
        updateFrequencyDisplay(fundamentalFreq); // Actualiza display
        
        if (frequencyData.length > 15) { // Si hay suficientes muestras
            const avgFreq = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length; // Calcula promedio
            determineGender(avgFreq); // Determina género por frecuencia
        }
    }
    
    animationId = requestAnimationFrame(analyzeFrequency); // Continúa análisis
}

// Calcular frecuencia fundamental
function calculateFundamentalFrequency() { // Función para calcular frecuencia base
    if (!analyser || !dataArray) return 0; // Sale si no hay datos
    
    const THRESHOLD = 140; // Umbral de detección
    const sampleRate = audioContext.sampleRate; // Tasa de muestreo
    const nyquist = sampleRate / 2; // Frecuencia de Nyquist
    
    const startIndex = Math.floor(80 * dataArray.length / nyquist); // Índice inicial (80Hz)
    const endIndex = Math.floor(400 * dataArray.length / nyquist); // Índice final (400Hz)
    
    for (let i = startIndex; i < endIndex; i++) { // Busca en rango de voz humana
        if (dataArray[i] > THRESHOLD) { // Si supera umbral
            return i * nyquist / dataArray.length; // Calcula frecuencia
        }
    }
    
    return 0; // No se encontró frecuencia válida
}

// Actualizar display de frecuencia
function updateFrequencyDisplay(frequency) { // Función para mostrar frecuencia
    document.getElementById('frequencyText').textContent = Math.round(frequency) + ' Hz'; // Muestra frecuencia redondeada
    
    const percentage = Math.min(100, Math.max(0, (frequency - 80) / 220 * 100)); // Calcula porcentaje para barra
    document.getElementById('frequencyFill').style.width = percentage + '%'; // Actualiza ancho de barra
}

// Determinar género basado en frecuencia
function determineGender(avgFrequency) { // Función para clasificar género
    let newGender; // Variable para nuevo género
    
    if (avgFrequency < 155) { // Frecuencia baja (masculina)
        newGender = 'male'; // Asigna masculino
    } else if (avgFrequency > 190) { // Frecuencia alta (femenina)
        newGender = 'female'; // Asigna femenino
    } else { // Frecuencia intermedia
        return; // No cambia género
    }
    
    if (newGender !== detectedGender) { // Si cambió el género
        detectedGender = newGender; // Actualiza género detectado
        const genderText = detectedGender === 'male' ? 'Masculina' : 'Femenina'; // Texto para mostrar
        updateStatus(`Voz ${genderText} detectada (${Math.round(avgFrequency)} Hz)`); // Actualiza estado
    }
}

// Seleccionar voz apropiada
function selectVoice(gender) { // Función para elegir voz según género
    if (voices.length === 0) { // Si no hay voces cargadas
        loadVoices(); // Carga voces
        return null; // Retorna nulo
    }
    
    const spanishVoices = voices.filter(voice => // Filtra voces en español
        voice.lang.startsWith('es') && voice.localService // Español y local
    );
    
    let selectedVoice = null; // Variable para voz seleccionada
    
    if (spanishVoices.length > 0) { // Si hay voces en español
        if (gender === 'male') { // Si es masculino
            selectedVoice = spanishVoices.find(voice => // Busca voz masculina
                /male|masculin|hombre|jorge|diego|carlos/i.test(voice.name) // Patrones masculinos
            );
        } else if (gender === 'female') { // Si es femenino
            selectedVoice = spanishVoices.find(voice => // Busca voz femenina
                /female|femenin|mujer|maria|carmen|lucia/i.test(voice.name) // Patrones femeninos
            );
        }
        
        if (!selectedVoice) { // Si no encontró voz específica
            selectedVoice = spanishVoices[0]; // Usa primera voz disponible
        }
    }
    
    return selectedVoice; // Retorna voz seleccionada
}

// Actualizar interfaz con imágenes
function updateUI(text, gender) { // Función para actualizar interfaz
    document.getElementById('voiceText').textContent = text; // Muestra texto reconocido
    
    const character = document.getElementById('character'); // Elemento del personaje
    const characterImage = document.getElementById('characterImage'); // Imagen del personaje
    const genderIndicator = document.getElementById('genderIndicator'); // Indicador de género
    
    // Actualizar personaje
    character.className = `character ${gender}`; // Añade clase de género
    
    // Cambiar imagen según el género
    characterImage.src = imageUrls[gender]; // Cambia imagen según género
    
    // Actualizar indicador de género
    if (gender === 'male') { // Si es masculino
        genderIndicator.textContent = 'Género: Masculino'; // Texto masculino
        genderIndicator.className = 'gender-indicator gender-male'; // Clase masculina
    } else if (gender === 'female') { // Si es femenino
        genderIndicator.textContent = 'Género: Femenino'; // Texto femenino
        genderIndicator.className = 'gender-indicator gender-female'; // Clase femenina
    } else { // Si es neutro
        genderIndicator.textContent = 'Género: Neutro'; // Texto neutro
        genderIndicator.className = 'gender-indicator gender-neutral'; // Clase neutra
    }
    
    updateStatus("Texto capturado. Presiona 'Repetir' para escuchar"); // Actualiza estado
}

// Actualizar estado
function updateStatus(message) { // Función para mostrar mensajes
    document.getElementById('status').textContent = message; // Actualiza texto de estado
}

// Resetear estado de escucha
function resetListening() { // Función para limpiar estado
    isListening = false; // Marca como no escuchando
    document.getElementById('listenBtn').classList.remove('recording'); // Quita clase visual
    document.getElementById('character').classList.remove('listening'); // Quita clase del personaje
    
    if (animationId) { // Si hay animación activa
        cancelAnimationFrame(animationId); // Cancela animación
    }
    
    if (microphone) { // Si hay micrófono conectado
        microphone.disconnect(); // Desconecta micrófono
        microphone = null; // Limpia referencia
    }
}

// Iniciar escucha
function startListening() { // Función para empezar a escuchar
    if (!recognition) { // Si no hay reconocimiento
        if (!initSpeechRecognition()) return; // Intenta inicializar
    }
    
    if (isListening) { // Si ya está escuchando
        recognition.stop(); // Detiene reconocimiento
        return; // Sale de función
    }
    
    frequencyData = []; // Limpia datos de frecuencia
    detectedGender = "neutral"; // Resetea género
    
    recognition.start(); // Inicia reconocimiento
}

// Repetir texto con voz ajustada
function repeatText() { // Función para reproducir texto
    if (!lastSpokenText) { // Si no hay texto
        updateStatus("No hay texto para repetir"); // Mensaje de error
        return; // Sale de función
    }
    
    const utterance = new SpeechSynthesisUtterance(lastSpokenText); // Crea utterance
    utterance.lang = 'es-ES'; // Idioma español
    utterance.volume = 1; // Volumen máximo
    
    const selectedVoice = selectVoice(detectedGender); // Selecciona voz apropiada
    if (selectedVoice) { // Si encontró voz
        utterance.voice = selectedVoice; // Asigna voz
    }
    
    if (detectedGender === 'male') { // Si es masculino
        utterance.pitch = 0.1; // Tono bajo
        utterance.rate = 0.6; // Velocidad lenta
    } else if (detectedGender === 'female') { // Si es femenino
        utterance.pitch = 2.0; // Tono alto
        utterance.rate = 1.2; // Velocidad rápida
    } else { // Si es neutro
        utterance.pitch = 1.0; // Tono normal
        utterance.rate = 0.9; // Velocidad normal
    }
    
    utterance.onstart = function() { // Evento al iniciar reproducción
        updateStatus("🔊 Reproduciendo..."); // Actualiza estado
        document.getElementById('character').classList.add('speaking'); // Añade clase hablando
    };
    
    utterance.onend = function() { // Evento al terminar reproducción
        updateStatus("Reproducción completada"); // Actualiza estado
        document.getElementById('character').classList.remove('speaking'); // Quita clase hablando
    };
    
    utterance.onerror = function(event) { // Evento de error en reproducción
        console.error('Error en síntesis:', event.error); // Log del error
        updateStatus("Error en la reproducción"); // Mensaje de error
        document.getElementById('character').classList.remove('speaking'); // Quita clase hablando
    };
    
    synthesis.cancel(); // Cancela síntesis previa
    synthesis.speak(utterance); // Inicia reproducción
}

// Iniciar juego
function startGame() { // Función para iniciar aplicación
    document.getElementById('startScreen').style.display = 'none'; // Oculta pantalla inicio
    document.getElementById('gameScreen').style.display = 'block'; // Muestra pantalla juego
    
    initializeGame(); // Inicializa componentes
    
    updateStatus("Juego iniciado. Presiona 'Escuchar' para comenzar"); // Actualiza estado
}

// Volver al inicio
function goHome() { // Función para volver al inicio
    document.getElementById('gameScreen').style.display = 'none'; // Oculta pantalla juego
    document.getElementById('startScreen').style.display = 'block'; // Muestra pantalla inicio
    
    lastSpokenText = ""; // Limpia texto hablado
    detectedGender = "neutral"; // Resetea género
    frequencyData = []; // Limpia datos de frecuencia
    document.getElementById('repeatBtn').disabled = true; // Desabilita botón repetir
    
    if (recognition && isListening) { // Si está reconociendo
        recognition.stop(); // Detiene reconocimiento
    }
    
    if (synthesis) { // Si hay síntesis activa
        synthesis.cancel(); // Cancela síntesis
    }
}

// Inicializar cuando se carga la página
window.addEventListener('load', function() { // Evento al cargar página
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) { // Si soporta getUserMedia
        navigator.mediaDevices.getUserMedia({ audio: true }) // Solicita permisos de audio
            .then(function(stream) { // Si se conceden permisos
                console.log('Permisos de micrófono concedidos'); // Log de éxito
                stream.getTracks().forEach(track => track.stop()); // Detiene stream temporal
            })
            .catch(function(error) { // Si se deniegan permisos
                console.warn('Permisos de micrófono denegados:', error); // Log de advertencia
            });
    }
    
    initializeGame(); // Inicializa juego
});
