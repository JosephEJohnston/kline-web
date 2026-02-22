/**
 * 对应 Zig 端导出的 WASM 函数接口
 * 已经适配高性能 QuantContext 架构
 */
interface KlineWasmExports extends WebAssembly.Exports {
    /**
     * WASM 线性内存对象
     */
    memory: WebAssembly.Memory;

    /**
     * 在 WASM Arena 中申请内存
     */
    alloc_memory(len: number): number;

    /**
     * 释放/重置整个 Arena 分配器
     * 建议在切换股票数据或重新回测前调用
     */
    free_memory(): void;

    /**
     * 解析 CSV 字符串并返回 QuantContext 指针
     * @returns QuantContext* (指向结构体的内存地址)
     */
    parse_csv_wasm(
        ptr: number,
        len: number,
        time_idx: number,
        open_idx: number,
        high_idx: number,
        low_idx: number,
        close_idx: number,
        volume_idx: number
    ): number;

    /**
     * 执行价格行为分析（提取 Trend Bar 等属性）
     * @param ctxPtr QuantContext 的指针
     */
    run_analysis(ctxPtr: number): void;

    /**
     * 计算指数移动平均线 (EMA)
     * @param ctxPtr QuantContext 的指针 (🌟 只有 3 个参数)
     * @param period 周期 (如 20)
     * @param outputPtr 接收计算结果的 f32 数组指针
     */
    calculate_ema(
        ctxPtr: number,
        period: number,
        outputPtr: number
    ): void;

    /**
     * 获取最近一次成功解析的数据行数 (actualCount)
     */
    get_last_parse_count(): number;
}