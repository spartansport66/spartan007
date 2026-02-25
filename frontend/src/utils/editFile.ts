export async function editFile(filePath: string, instructions: string) {
  const response = await fetch('http://localhost:5000/api/edit-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, instructions })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to edit file');
  }

  return await response.json();
}