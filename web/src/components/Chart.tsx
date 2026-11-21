import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export interface Series { name: string; color?: string; values: number[] }
/** A live chart (Apache ECharts). The same numbers are also given as a table for screen readers. */
export function Chart({ title, labels, series, kind = 'line' }: { title: string; labels: string[]; series: Series[]; kind?: 'line' | 'bar' }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const c = (chart.current ??= echarts.init(el.current));
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink-2').trim() || '#445', line = css.getPropertyValue('--line').trim() || '#dde';
    c.setOption({
      animationDuration: document.documentElement.dataset.motion === 'reduced' ? 0 : 500,
      grid: { left: 40, right: 16, top: series.length > 1 ? 34 : 16, bottom: 28 },
      tooltip: { trigger: 'axis' }, legend: series.length > 1 ? { top: 0, textStyle: { color: ink } } : undefined,
      xAxis: { type: 'category', data: labels, axisLabel: { color: ink, hideOverlap: true }, axisLine: { lineStyle: { color: line } } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: ink }, splitLine: { lineStyle: { color: line } } },
      series: series.map((s) => ({ name: s.name, type: kind, data: s.values, smooth: kind === 'line', showSymbol: labels.length < 40, itemStyle: { color: s.color }, lineStyle: { width: 2.5 }, areaStyle: kind === 'line' && series.length === 1 ? { opacity: 0.12 } : undefined })),
    }, true);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [labels, series, kind]);
  useEffect(() => () => { chart.current?.dispose(); chart.current = null; }, []);
  return (
    <figure style={{ margin: 0 }}>
      <figcaption><b>{title}</b></figcaption>
      <div className="chart" ref={el} aria-hidden="true" />
      <table className="sr"><caption>{title}</caption><thead><tr><th>Period</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => <tr key={l}><td>{l}</td>{series.map((s) => <td key={s.name}>{s.values[i]}</td>)}</tr>)}</tbody></table>
    </figure>
  );
}
