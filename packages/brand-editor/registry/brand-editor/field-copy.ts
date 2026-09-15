import type { FieldId } from "@pxlhut/brand-core";

export interface FieldCopy {
  label: string;
  description?: string;
}

/**
 * Owner-facing label and help text for each §33 field. Deliberately separate
 * from `FIELD_REGISTRY`'s `why` strings in `@pxlhut/brand-core` — those are
 * the developer-facing rationale for a tier choice, not copy for the person
 * filling in the form.
 */
export const FIELD_COPY: Record<FieldId, FieldCopy> = {
  companyName: { label: "Company name" },
  logo: { label: "Logo", description: "Used on both light and dark backgrounds — upload both." },
  brandColor: { label: "Brand colour", description: "The one colour everything else is generated from." },
  semanticColors: { label: "Status colours", description: "Error, success, warning and info." },
  headingFont: { label: "Heading font" },
  bodyFont: { label: "Body font" },
  radius: { label: "Corner style" },
  density: { label: "Density" },
  neutralTone: { label: "Neutral tone" },
  buttonStyle: { label: "Button style" },
  elevation: { label: "Elevation", description: "Surface depth and border strength." },
  advancedTokens: { label: "Advanced tokens", description: "Direct CSS variable overrides. Unguarded." },
  supportUrl: { label: "Support URL" },
  emailSenderName: { label: "Email sender name", description: "The \"From\" name on transactional email." },
};
