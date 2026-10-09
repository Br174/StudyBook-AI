/* LAB05 • Sintesi vocale condivisa e cancellabile: Android nativo, browser fallback.
   Nessuna dipendenza da API remote; voce italiana fornita dal dispositivo. */
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const LANGUAGE = 'it-IT';
const MAX_CHARS = 540;
let generation = 0;

export function speechChunks(value, max = MAX_CHARS) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = [];
  let remaining = text;
  while (remaining.length > max) {
    const view = remaining.slice(0, max + 1);
    const sentence = Math.max(view.lastIndexOf('. '), view.lastIndexOf('! '), view.lastIndexOf('? '));
    const comma = Math.max(view.lastIndexOf('; '), view.lastIndexOf(', '));
    const space = view.lastIndexOf(' ');
    const cut = sentence > max * .48 ? sentence + 1 : comma > max * .55 ? comma + 1 : space > max * .45 ? space : max;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

export async function stopStudySpeech() {
  generation += 1;
  try {
    if (Capacitor.isNativePlatform()) await TextToSpeech.stop();
    else if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  } catch { /* Un dispositivo privo di TTS può non supportare lo stop. */ }
}

function speakWeb(text) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      reject(new Error('Sintesi vocale non disponibile in questo browser.'));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = resolve;
    utterance.onerror = (event) => reject(new Error('La lettura vocale è stata interrotta: ' + (event.error || 'errore del motore.')));
    window.speechSynthesis.speak(utterance);
  });
}

export async function speakStudyText(text, { onStart, onEnd, onError } = {}) {
  const parts = speechChunks(text);
  if (!parts.length) {
    onError?.('Non c’è testo da leggere.');
    return false;
  }
  // Una richiesta nuova invalida subito le precedenti, anche se arrivano tocchi rapidi.
  const token = ++generation;
  try {
    if (Capacitor.isNativePlatform()) await TextToSpeech.stop();
    else if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  } catch { /* Il TTS verrà verificato alla richiesta successiva. */ }
  if (token !== generation) return false;
  try {
    if (Capacitor.isNativePlatform()) {
      const support = await TextToSpeech.isLanguageSupported({ lang: LANGUAGE });
      if (!support.supported) throw new Error('Voce italiana non disponibile. Installa o abilita una voce italiana nelle impostazioni di sintesi vocale Android.');
    }
    if (token !== generation) return false;
    onStart?.();
    for (let i = 0; i < parts.length && token === generation; i += 1) {
      if (Capacitor.isNativePlatform()) {
        await TextToSpeech.speak({
          text: parts[i], lang: LANGUAGE, rate: .98, pitch: 1, volume: 1,
          queueStrategy: i === 0 ? 0 : 1,
        });
      } else {
        await speakWeb(parts[i]);
      }
    }
    if (token !== generation) return false;
    onEnd?.();
    return true;
  } catch (error) {
    if (token !== generation) return false;
    onError?.(String(error?.message || error || 'Lettura vocale non riuscita.'));
    return false;
  }
}

export async function installItalianSpeechVoice() {
  if (Capacitor.isNativePlatform()) return TextToSpeech.openInstall();
  throw new Error('Le voci del browser sono gestite dalle impostazioni del dispositivo.');
}
