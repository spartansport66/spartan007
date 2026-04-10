/**
 * Type definitions for Supabase migration
 */

export interface MigrationConfig {
  projectId: string;
  apiKey: string; // Service Role Key or Anon Key
  description?: string;
}

export interface TableSchema {
  name: string;
  columns: ColumnDef[];
  indexes?: IndexDef[];
}

export interface ColumnDef {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault?: string;
}

export interface IndexDef {
  name: string;
  definition: string;
}

export interface SchemaExport {
  tables: TableSchema[];
}

export interface DataExport {
  tables: Array<{
    name: string;
    data: any[];
  }>;
}

export interface RLSPolicy {
  table: string;
  name: string;
  definition: string;
  permissive?: boolean;
  roles?: string[];
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  createdAt?: string;
  lastSignInAt?: string;
  metadata?: Record<string, any>;
}

export interface UserRole {
  userId: string;
  role: string;
  dealerId?: string;
  createdAt?: string;
}

export interface StorageBucket {
  id: string;
  name: string;
  public: boolean;
}

export interface DatabaseFunction {
  name: string;
  definition: string;
  type: string;
}

export interface Trigger {
  name: string;
  table: string;
  definition: string;
}

export interface MigrationStep {
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  details?: string;
  error?: string;
}

export interface MigrationResult {
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  steps: MigrationStep[];
  errors: string[];
  summary?: string;
}

export interface Statistics {
  tableCount: number;
  rowCount: number;
}

export interface MigrationRequest {
  sourcProjectId: string;
  sourceApiKey: string;
  targetProjectId: string;
  targetApiKey: string;
  includeUsers?: boolean;
  includeStorage?: boolean;
  includeFunctions?: boolean;
}
