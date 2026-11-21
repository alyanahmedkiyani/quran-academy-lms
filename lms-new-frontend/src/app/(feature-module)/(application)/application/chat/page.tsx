"use client";

import { Suspense } from "react";
import ChatComponent from "@/components/pages/application-modules/application/chat/chat";

export default function ChatPage () {
  return (
    <Suspense fallback={<div />}>
      <ChatComponent />
    </Suspense>
  );
}
