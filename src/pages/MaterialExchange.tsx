import React from 'react';
import ExchangeMaterialCard from '@/components/ExchangeMaterialCard';

const MaterialExchangePage: React.FC = () => {
  return (
    <div className="min-h-screen p-6 bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-4">Material Exchange</h1>
      <div className="max-w-2xl">
        <ExchangeMaterialCard />
      </div>
    </div>
  );
};

export default MaterialExchangePage;
