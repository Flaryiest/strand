import {
  createBrowserRouter,
  createRoutesFromElements,
  Route
} from 'react-router-dom';

import IndexPage from '@/pages/home/index';
import LoginPage from '@/pages/login/login';
import SignupPage from '@/pages/signup/signup';
import ChatPage from '@/pages/chat/chat';
import GoogleCallback from '@/pages/auth/GoogleCallback';
import DemoPage from '@/pages/demo/demo';
import PricingPage from '@/pages/pricing/pricing';
import ErrorPage from '@/pages/error/error';

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:chatId" element={<ChatPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="*" element={<ErrorPage />} />
    </>
  )
);

export default router;
