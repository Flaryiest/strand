import Router from '@/app/router';
import AppProvider from '@/app/provider';
import { RouterProvider } from 'react-router-dom';
export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={Router} />
    </AppProvider>
  );
}
