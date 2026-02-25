import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function AutoEditButton({ filePath, instructions }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/edit-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, instructions })
      });
      const data = await res.json();
      alert(data.message || JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert('Failed to edit file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? 'Editing...' : 'Auto Edit File'}
    </Button>
  );
}