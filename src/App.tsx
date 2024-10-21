import React from 'react';
import Calendar from './components/Calendar';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-10 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-8">
          Kalender Expert by Evan
        </h1>
        <Calendar />
      </div>
    </div>
  );
};

export default App;
