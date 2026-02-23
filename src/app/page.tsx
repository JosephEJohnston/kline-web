'use client'
import BacktestPage from "@/components/test/BacktestPage";
import {WasmLockProvider, WasmResourceLock} from "@/components/WasmLockManager";
import {useMemo} from "react";

export default function Home() {
    const manager = useMemo(() => new WasmResourceLock(), []);

    return (
        <>
            <WasmLockProvider lockManager={manager}>
                <BacktestPage />
            </WasmLockProvider>
        </>
      );
}
