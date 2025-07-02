import React from 'react';

export default function App() {
  console.log('🔍 Ultra-minimal App component rendering...');
  console.log('🔍 App component executed successfully!');
  
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Ultra Minimal App</h1>
      <p>If you can see this, React rendering works!</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}