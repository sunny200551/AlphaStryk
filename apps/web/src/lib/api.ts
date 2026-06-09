const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const url = `${API_URL}${path}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  } as HeadersInit;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Pass authentication cookies (JWT) automatically
  });

  return response;
};
