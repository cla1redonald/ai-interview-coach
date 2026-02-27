import configJson from '../../coach.config.json';

export interface BrandingConfig {
  primaryColor: string;
  companyUrl: string;
}

export interface CoachConfig {
  company: string;
  role: string;
  branding: BrandingConfig;
  personas: string[];
}

const config: CoachConfig = configJson as CoachConfig;

export const company = config.company;
export const role = config.role;
export const branding = config.branding;
export const primaryColor = config.branding.primaryColor;
export const companyUrl = config.branding.companyUrl;

export default config;
