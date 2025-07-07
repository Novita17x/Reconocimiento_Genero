 // Variables globales
 let recognition;
 let synthesis;
 let audioContext;
 let analyser;
 let microphone;
 let dataArray;
 let isRecording = false;
 let detectedGender = 'analyzing';
 let voices = [];
 let frequencyData = [];
 let animationId;

 // Inicialización
 window.onload = function() {
     initSpeechRecognition();
     initSpeechSynthesis();
     initAudioAnalysis();
 };

 function startGame() {
     document.getElementById('startScreen').style.display = 'none';
     document.getElementById('gameContainer').style.display = 'block';
 }

 function goHome() {
     document.getElementById('gameContainer').style.display = 'none';
     document.getElementById('startScreen').style.display = 'flex';
     stopRecording();
 }

 function initSpeechRecognition() {
     if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
         recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
         recognition.continuous = false;
         recognition.interimResults = false;
         recognition.lang = 'es-ES';

         recognition.onstart = function() {
             updateStatus('🎤 Escuchando y analizando tu voz...');
             document.getElementById('soundWaves').classList.add('active');
         };

         recognition.onresult = function(event) {
             const transcript = event.results[0][0].transcript;
             updateStatus('✅ Texto reconocido: "' + transcript + '"');
             showSpeechBubble(transcript);
             
             // Esperar un momento para completar el análisis de frecuencia
             setTimeout(() => {
                 speakText(transcript);
             }, 500);
         };

         recognition.onerror = function(event) {
             updateStatus('❌ Error: ' + event.error);
             stopRecording();
         };

         recognition.onend = function() {
             stopRecording();
         };
     } else {
         updateStatus('❌ Tu navegador no soporta reconocimiento de voz');
     }
 }

 function initSpeechSynthesis() {
     synthesis = window.speechSynthesis;
     
     synthesis.onvoiceschanged = function() {
         voices = synthesis.getVoices();
     };
     
     voices = synthesis.getVoices();
 }

 async function initAudioAnalysis() {
     try {
         audioContext = new (window.AudioContext || window.webkitAudioContext)();
         analyser = audioContext.createAnalyser();
         analyser.fftSize = 2048;
         
         const bufferLength = analyser.frequencyBinCount;
         dataArray = new Uint8Array(bufferLength);
         
     } catch (error) {
         console.error('Error inicializando análisis de audio:', error);
         updateStatus('⚠️ Análisis de audio no disponible');
     }
 }

 async function startAudioAnalysis() {
     try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         microphone = audioContext.createMediaStreamSource(stream);
         microphone.connect(analyser);
         
         frequencyData = [];
         analyzeFrequency();
         
     } catch (error) {
         console.error('Error accediendo al micrófono:', error);
         updateStatus('❌ No se puede acceder al micrófono');
     }
 }

 function analyzeFrequency() {
     if (!isRecording || !analyser) return;
     
     analyser.getByteFrequencyData(dataArray);
     
     // Calcular frecuencia fundamental
     const fundamentalFreq = calculateFundamentalFrequency();
     
     if (fundamentalFreq > 0) {
         frequencyData.push(fundamentalFreq);
         updateFrequencyDisplay(fundamentalFreq);
         
         // Determinar género basado en frecuencia
         if (frequencyData.length > 10) { // Esperar suficientes muestras
             const avgFreq = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
             determineGender(avgFreq);
         }
     }
     
     animationId = requestAnimationFrame(analyzeFrequency);
 }

function calculateFundamentalFrequency() {
 if (!analyser) return 0;
 
 analyser.getByteFrequencyData(dataArray);

 // UMBRAL DE ENERGÍA: Ignoramos cualquier frecuencia que no tenga
 // suficiente volumen para ser considerada una voz.
 // Puedes ajustar este valor entre 120 y 160.
 const THRESHOLD = 140; 

 // RANGO DE BÚSQUEDA: Desde una voz masculina muy grave (80Hz)
 // hasta el límite de una voz femenina (400Hz).
 const startIndex = Math.floor(80 * dataArray.length / (audioContext.sampleRate / 2));
 const endIndex = Math.floor(400 * dataArray.length / (audioContext.sampleRate / 2));

 // BÚSQUEDA ASCENDENTE: Iteramos desde la frecuencia más baja hacia la más alta.
 for (let i = startIndex; i < endIndex; i++) {
     // ¿Este pico de frecuencia es lo suficientemente fuerte para ser la voz?
     if (dataArray[i] > THRESHOLD) {
         // ¡SÍ! Como estamos buscando de abajo hacia arriba, este es
         // muy probablemente el tono fundamental.
         const frequency = i * audioContext.sampleRate / (2 * dataArray.length);
         
         // Lo devolvemos y dejamos de buscar.
         return frequency;
     }
 }
 
 // Si el bucle termina, no se encontró ninguna frecuencia lo suficientemente fuerte.
 return 0;
}

 function updateFrequencyDisplay(frequency) {
     document.getElementById('frequencyDisplay').textContent = 
         `Frecuencia: ${Math.round(frequency)} Hz`;
     
     // Actualizar barra visual (rango aproximado 80-300 Hz)
     const percentage = Math.min(100, Math.max(0, (frequency - 80) / 220 * 100));
     document.getElementById('frequencyBar').style.width = percentage + '%';
 }

 function determineGender(avgFrequency) {
     // Rangos aproximados:
     // Hombres: 85-180 Hz (promedio ~125 Hz)
     // Mujeres: 165-265 Hz (promedio ~210 Hz)
     
     let newGender;
     if (avgFrequency < 120) {
         newGender = 'male';
     } else if (avgFrequency > 160) {
         newGender = 'female';
     } else {
         // Zona ambigua, mantener análisis
         return;
     }
     
     if (newGender !== detectedGender) {
         detectedGender = newGender;
         updateGenderDisplay();
         updateCharacter();
         
         const genderText = detectedGender === 'male' ? 'Masculina' : 'Femenina';
         updateStatus(`🎯 Voz ${genderText} detectada (${Math.round(avgFrequency)} Hz)`);
     }
 }

 function updateGenderDisplay() {
     const indicator = document.getElementById('genderIndicator');
     indicator.className = 'gender-indicator ' + detectedGender;
     
     switch(detectedGender) {
         case 'male':
             indicator.textContent = '👨 Voz Masculina Detectada';
             break;
         case 'female':
             indicator.textContent = '👩 Voz Femenina Detectada';
             break;
         default:
             indicator.textContent = '🔍 Analizando voz...';
     }
 }

 function updateCharacter() {
     const character = document.getElementById('character');
     character.className = 'character ' + (detectedGender === 'analyzing' ? '' : detectedGender);
 }

 function toggleRecording() {
     if (!isRecording) {
         startRecording();
     } else {
         stopRecording();
     }
 }

 async function startRecording() {
     if (!recognition) {
         updateStatus('❌ Reconocimiento de voz no disponible');
         return;
     }

     isRecording = true;
     frequencyData = [];
     detectedGender = 'analyzing';
     updateGenderDisplay();
     updateCharacter();
     
     const recordBtn = document.getElementById('recordBtn');
     recordBtn.classList.add('recording');
     recordBtn.textContent = '🛑 Detener Grabación';
     
     // Iniciar análisis de audio
     await startAudioAnalysis();
     
     // Iniciar reconocimiento de voz
     recognition.start();
 }

 function stopRecording() {
     if (recognition && isRecording) {
         recognition.stop();
     }
     
     isRecording = false;
     
     // Detener análisis de audio
     if (animationId) {
         cancelAnimationFrame(animationId);
     }
     
     if (microphone) {
         microphone.disconnect();
         microphone = null;
     }
     
     const recordBtn = document.getElementById('recordBtn');
     recordBtn.classList.remove('recording');
     recordBtn.textContent = '🎤 Presiona para Hablar';
     
     document.getElementById('soundWaves').classList.remove('active');
     document.getElementById('character').classList.remove('speaking');
 }

function speakText(text) {
  if (!synthesis) return;

  synthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES'; // Asegurar el idioma
  utterance.volume = 1;

  // CAMBIO CLAVE: Primero intentamos encontrar la voz ideal
  const voice = findBestVoice();
  
  if (voice) {
      // Plan A (Ideal): Se encontró una voz nativa masculina o femenina. Usémosla.
      // El pitch lo dará la propia voz, no necesitamos forzarlo.
      utterance.voice = voice;
      utterance.rate = 0.9; // Ajustar velocidad si se desea
  } else {
      // Plan B (Fallback): No se encontró una voz específica.
      // Usamos la voz por defecto del navegador y modificamos su PITCH.
      console.warn("No se encontró una voz específica. Usando fallback de pitch.");
      
      if (detectedGender === 'female') {
          // 👇 AQUÍ ESTÁN LOS CAMBIOS
          utterance.pitch = 1.7; // Aumentamos el tono aún más (antes era 1.5)
          utterance.rate = 1.1;  // Una velocidad un poco más rápida para sonar más fluida
      } else if (detectedGender === 'male') {
          utterance.pitch = 0.5;
          utterance.rate = 0.85;
      } else {
          utterance.pitch = 1.0; 
          utterance.rate = 0.9;
      }
  }

  utterance.onstart = function() {
      document.getElementById('character').classList.add('speaking');
      const genderText = detectedGender === 'male' ? 'masculina' : 
                           detectedGender === 'female' ? 'femenina' : 'neutra';
      updateStatus(`🔊 Reproduciendo con voz ${genderText}`);
  };

  utterance.onend = function() {
      document.getElementById('character').classList.remove('speaking');
      hideSpeechBubble();
      updateStatus('✅ Listo para una nueva grabación');
  };

  synthesis.speak(utterance);
}

function findBestVoice() {
  if (voices.length === 0) {
     console.log("Las voces aún no se han cargado.");
     return null;
  }

  // Filtramos primero por voces en español que sean locales (más fiables)
  const spanishVoices = voices.filter(voice => voice.lang.startsWith('es') && voice.localService);
 
  if (spanishVoices.length === 0) {
     console.log("No se encontraron voces locales en español, intentando con cualquiera en español.");
     // Si no hay locales, buscamos cualquiera en español.
     const allSpanishVoices = voices.filter(voice => voice.lang.startsWith('es'));
     if(allSpanishVoices.length === 0) return null; // No hay ninguna en español
  }

  let bestVoice = null;

  if (detectedGender === 'female') {
      // Búsqueda de nombres comunes para voces femeninas
      bestVoice = spanishVoices.find(voice => 
          /female|mujer|femenina|helena|laura|paulina/i.test(voice.name)
      );
  } else if (detectedGender === 'male') {
      // Búsqueda de nombres comunes para voces masculinas
      bestVoice = spanishVoices.find(voice => 
          /male|hombre|masculina|jorge|diego|pablo/i.test(voice.name)
      );
  }

  // Si encontramos una voz, la devolvemos. Si no, devolvemos null.
  return bestVoice; 
}


 function showSpeechBubble(text) {
     const bubble = document.getElementById('speechBubble');
     bubble.textContent = text;
     bubble.classList.add('show');
 }

 function hideSpeechBubble() {
     const bubble = document.getElementById('speechBubble');
     bubble.classList.remove('show');
 }

 function updateStatus(message) {
     document.getElementById('status').textContent = message;
 }

 // Solicitar permisos de micrófono al cargar
 navigator.mediaDevices.getUserMedia({ audio: true })
     .then(function(stream) {
         console.log('Permisos de micrófono concedidos');
         stream.getTracks().forEach(track => track.stop());
         updateStatus('🎤 Micrófono listo - El juego detectará tu voz automáticamente');
     })
     .catch(function(error) {
         console.error('Error al acceder al micrófono:', error);
         updateStatus('❌ Se necesitan permisos de micrófono para el análisis de voz');
     });
