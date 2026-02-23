import React, { createContext, useContext, useEffect, useMemo } from 'react';

/**
 * 1. 核心逻辑类：负责具体的锁计数与清理调度
 */
export class WasmResourceLock {
    private locks = new Set<string>();
    private pendingCleanup: (() => void) | null = null;

    public lock(id: string) {
        this.locks.add(id);
    }

    public unlock(id: string) {
        this.locks.delete(id);
        if (this.locks.size === 0 && this.pendingCleanup) {
            this.pendingCleanup();
            this.pendingCleanup = null;
            console.log("🛡️ [WasmLock] 所有视图渲染完成，内存已安全重置");
        }
    }

    public scheduleCleanup(fn: () => void) {
        if (this.locks.size === 0) {
            fn();
        } else {
            this.pendingCleanup = fn;
        }
    }
}

/**
 * 2. 创建 React Context
 */
const WasmLockContext = createContext<WasmResourceLock | null>(null);

/**
 * 3. 封装 Provider 组件：简化顶层调用
 */
export const WasmLockProvider: React.FC<{ lockManager: WasmResourceLock | null, children: React.ReactNode }> = ({ lockManager, children }) => {
    return (
        <WasmLockContext.Provider value={lockManager}>
            {children}
        </WasmLockContext.Provider>
    );
};

/**
 * 4. 封装自定义 Hook：子组件的一键式调用
 */
export const useWasmLock = (id: string) => {
    const lockManager = useContext(WasmLockContext);

    useEffect(() => {
        if (!lockManager) return;

        lockManager.lock(id);
        // 组件卸载或 ID 变化时自动解锁
        return () => lockManager.unlock(id);
    }, [id, lockManager]);

    return lockManager;
};

export const useWasmManager = () => {
    const manager = useContext(WasmLockContext);
    if (!manager) throw new Error("Wasm 管理器未注入");
    return manager;
};
