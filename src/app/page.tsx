'use client';

import { useState } from 'react';
import LandingPage from '@/components/LandingPage';
import ChatContainer from '@/components/ChatContainer';

export default function Home() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />;
  }

  return <ChatContainer />;
}
