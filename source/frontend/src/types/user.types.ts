export interface User {
  id: string;
  name?: string;
  login: string;
  first_name: string | null;
  second_name: string | null;
  surname: string | null;
  sex: boolean | null;
  birth_date: string | null;
  department_id: string | null;
  /** Название отдела (как в ответе API /api/users/) */
  department_title?: string | null;
  department?: string | null;
  position_id: string | null;
  /** Название должности (как в ответе API /api/users/) */
  position_name?: string | null;
  position?: string | null;
  manager_id: string | null;
  manager_name?: string | null;
  is_superuser?: boolean;
}

export interface UserUploadRequest {
  file: File;
}

export interface UserUploadResponse {
  success: boolean;
  message: string;
  importedCount: number;
  failedCount: number;
  errors?: Array<{
	row: number;
	error: string;
  }>;
}