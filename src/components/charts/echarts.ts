// Tree-shaken ECharts build: only what the dashboard uses.
import * as echarts from 'echarts/core';
import { BarChart, LineChart, ScatterChart, CustomChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent,
  DataZoomComponent, AriaComponent, GraphicComponent, AxisPointerComponent, LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { UniversalTransition, LabelLayout, LegacyGridContainLabel } from 'echarts/features';

echarts.use([
  BarChart, LineChart, ScatterChart, CustomChart,
  GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent,
  DataZoomComponent, AriaComponent, GraphicComponent, AxisPointerComponent, LegendComponent,
  CanvasRenderer, UniversalTransition, LabelLayout, LegacyGridContainLabel,
]);

export { echarts };
export type EChartsOption = Parameters<echarts.ECharts['setOption']>[0];
