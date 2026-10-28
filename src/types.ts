export type AuthUser = {
  id: string;
  username: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type ApplicationSummary = {
  name: string;
  display_name: string;
  description: string;
};

export type ProfileResponse = {
  id: string;
  app_name: string;
  auth_id: string;
  profile: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type JsonSchema = {
  title?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchemaProperty>;
};

export type JsonSchemaProperty = {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
};

export type Session = {
  token: string;
  user: AuthUser;
};
