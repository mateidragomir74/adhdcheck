// NFR-04: the version of the consent text the parent agrees to before the first session. It is stored with
// each consent (processing_consents.version), and POST /api/play-links asks for a consent of this version.
// The text itself is a placeholder until the texts owner writes it (docs/02 NFR-04 "Consent text: TODO");
// when the final text lands, change this version so every parent is asked again.
export const PROCESSING_CONSENT_VERSION = "draft-2026-10-21";
