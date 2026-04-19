export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

export interface Session {
  id: string;
  personaId: string;
  messages: Message[];
  timestamp: Date;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  icon?: string;
  content?: string; // Optional - loaded server-side only in API route
}

// ─── Phase 2: APPLY loop types ──────────────────────────────────────────────

export type ApplicationStatus =
  | 'researching' | 'assessed' | 'applying'
  | 'applied' | 'interviewing' | 'rejected'
  | 'offer' | 'withdrawn';

export type RoleArchetype = 'exec' | 'ic' | 'portfolio' | 'advisory' | 'hybrid';

export type MaterialType = 'cv' | 'cover_letter' | 'tracking_note';

export type DimensionConfidence = 'high' | 'medium' | 'low';

export interface DimensionScore {
  score: number;              // 1-10
  evidence: string;           // 1-3 sentence explanation
  confidence: DimensionConfidence;
}

export interface FitWeights {
  domain: number;       // default 15
  seniority: number;    // default 15
  scope: number;        // default 15
  technical: number;    // default 10
  mission: number;      // default 10
  location: number;     // default 15
  compensation: number; // default 10
  culture: number;      // default 10
}

export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  domain: 15,
  seniority: 15,
  scope: 15,
  technical: 10,
  mission: 10,
  location: 15,
  compensation: 10,
  culture: 10,
};

export interface ResearchSource {
  url: string;
  source_type: 'firecrawl' | 'companies_house' | 'exa' | 'user_provided';
  fetched_at: string; // ISO-8601
}

export interface JobApplication {
  id: string;
  userId: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string | null;
  jobDescription: string;
  salary: string | null;
  location: string | null;
  researchedAt: string | null;
  assessedAt: string | null;
  materialsAt: string | null;
  fitScoreOverall: number | null;
  fitArchetype: RoleArchetype | null;
  status: ApplicationStatus;
  notes: string | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyResearch {
  id: string;
  jobApplicationId: string;
  userId: string;
  companySize: string | null;
  fundingStage: string | null;
  revenue: string | null;
  foundedYear: string | null;
  headquarters: string | null;
  industry: string | null;
  recentNews: string | null;
  techStack: string | null;
  cultureSignals: string | null;
  keyPeople: string | null;
  missionAndValues: string | null;
  sources: ResearchSource[];
  companiesHouseNumber: string | null;
  companiesHouseData: object | null;
  createdAt: string;
  updatedAt: string;
}

export interface FitAssessment {
  id: string;
  jobApplicationId: string;
  userId: string;
  archetype: RoleArchetype;
  archetypeRationale: string | null;
  dimDomainIndustry: DimensionScore;
  dimSeniority: DimensionScore;
  dimScope: DimensionScore;
  dimTechnical: DimensionScore;
  dimMission: DimensionScore;
  dimLocation: DimensionScore;
  dimCompensation: DimensionScore;
  dimCulture: DimensionScore;
  overallScore: number;        // 1-100
  weights: FitWeights;
  redFlags: string[];
  greenFlags: string[];
  exampleIdsUsed: string[];
  dismissedRedFlags: string[]; // PM Decision 3 — persisted dismiss state
  dimensionAnnotations: Partial<Record<keyof FitWeights, string>>; // PM Decision 4
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMaterial {
  id: string;
  jobApplicationId: string;
  userId: string;
  type: MaterialType;
  content: string;
  version: number;
  exampleIdsUsed: string[];
  promptHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchRun {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  fitThreshold: number;
  summaryTable: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 2: API Request/Response shapes ────────────────────────────────────

export interface CreateApplicationRequest {
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  jobUrl?: string;
  salary?: string;
  location?: string;
}

export interface RunResearchRequest {
  force?: boolean;
}

export interface RunAssessmentRequest {
  force?: boolean;
  weights?: Partial<FitWeights>;
}

export interface GenerateMaterialsRequest {
  types: MaterialType[];
  fitThreshold?: number;
  force?: boolean;
  masterCv?: string;
}

export interface CreateBatchRequest {
  markdown: string;
  fitThreshold?: number;
}

export interface RunBatchRequest {
  masterCv?: string;
}
