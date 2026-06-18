export async function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const key = localStorage.getItem('BEM_API_KEY') || '';
  
  const headersObj: Record<string, string> = {};
  
  if (init && init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, name) => {
        headersObj[name] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([name, value]) => {
        headersObj[name] = value;
      });
    } else {
      Object.assign(headersObj, init.headers);
    }
  }

  if (key) {
    headersObj['x-api-key'] = key;
  }

  const newInit: RequestInit = {
    ...init,
    headers: headersObj
  };

  return fetch(input, newInit);
}
