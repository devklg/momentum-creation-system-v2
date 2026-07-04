/**
 * VoiceBox runtime feature flag.
 *
 * Default OFF and fail-closed. Only the exact string "true" enables the
 * internal `.team` browser-voice generation edge. The flag is read at call
 * time so a deploy-time env change takes effect without code changes, and it
 * can never be sourced from a request.
 */

export function voiceboxRuntimeEnabled(): boolean {
  return process.env.VOICEBOX_RUNTIME_ENABLED === 'true';
}
