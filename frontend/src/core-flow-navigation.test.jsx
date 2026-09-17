import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformShell, ProjectNavigation, ProfessionalWorkspaceNav, ResponseMatrixWorkspace } from './main.jsx';

describe('四阶段项目流程导航', () => {
  it('按业务阶段显示当前动作并保留专业工作区入口', () => {
    const html = renderToStaticMarkup(<><ProjectNavigation activeTab="审核中心" setActiveTab={() => {}} data={{ tenderFiles: [{ id: 'file-1' }], requirementBaseline: null, versions: [] }} /><ProfessionalWorkspaceNav activeTab="审核中心" setActiveTab={() => {}} /></>);
    expect(html).toContain('项目准备');
    expect(html).toContain('审核与补充');
    expect(html).toContain('当前');
    expect(html).toContain('专业工作区');
    expect(html).toContain('需求解析');
  });

  it('平台层显示四个高频业务模块，系统管理不抢占主入口', () => {
    const html = renderToStaticMarkup(<PlatformShell active="工作台" onNavigate={() => {}} title="工作台"><p>内容</p></PlatformShell>);
    expect(html).toContain('工作台');
    expect(html).toContain('投标项目');
    expect(html).toContain('企业资料库');
    expect(html).toContain('标书检查');
    expect(html).toContain('系统管理');
  });

  it('专业工作区提供只读响应矩阵入口和业务化状态', () => {
    const html = renderToStaticMarkup(<><ProfessionalWorkspaceNav activeTab="响应矩阵" setActiveTab={() => {}} /><ResponseMatrixWorkspace projectId="P1" /></>);
    expect(html).toContain('响应矩阵');
    expect(html).toContain('只读');
    expect(html).toContain('准备状态');
  });
});
