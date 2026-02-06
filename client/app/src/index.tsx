import React from 'react';
import ReactDOM from 'react-dom/client';
// import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { AppProvider } from './state/contexts/AppContext';
import App from './App';


const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;


if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// ReactDOM.createRoot(document.getElementById('root')!).render(
//   <React.StrictMode>
//     <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
//       {/* <BrowserRouter> */}
//         <App />
//       {/* </BrowserRouter> */}
//     </ClerkProvider>
//   </React.StrictMode>
// );
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* <BrowserRouter> */}
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <AppProvider>
          <App />
        </AppProvider>
      </ClerkProvider>
    {/* </BrowserRouter> */}
  </React.StrictMode>
);
