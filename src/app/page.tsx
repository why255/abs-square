'use client';

import { useState } from 'react';
import LandingPage from '@/components/LandingPage';
import ChatContainer from '@/components/ChatContainer';

export type Scenario = 'F' | 'C';

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [scenario, setScenario] = useState<Scenario>('F');

  if (!entered) {
    return <LandingPage onEnter={(s: Scenario) => { setScenario(s); setEntered(true); }} />;
  }

  return <ChatContainer scenario={scenario} />;
}
