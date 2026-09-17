# REAL_ENTERPRISE_UPLOAD_TEST_PACK_V1

这是“用户上传各种企业资料”的第一轮真实公开文档包设计。

## 原则
- 单一企业：Huawei
- 真实第一方公开 PDF
- 不抓网页正文，不将 HTML 当作企业上传文档
- Requirement-blind
- 直接走现有文件上传/解析/Chunk/Fact Producer 路径

## 这 12 份真实 PDF 主要覆盖
- 企业主体/年度报告
- 产品组合
- 产品彩页/规格参数
- 技术白皮书
- 解决方案
- 运维/架构
- 行业方案/案例型内容

## 尚未覆盖、但完整标书企业材料库应测试
这些材料通常不是公开资料，建议第二包使用“脱敏或合成但生产形态真实”的文件：
- 营业执照扫描 PDF/JPG
- ISO/ITSS/CMMI/CCRC 等证书扫描件
- 软件著作权/专利
- 项目合同关键页 + 验收报告
- 项目经理/人员简历 + 证书
- 产品参数 XLSX
- 服务SOP/售后方案 DOCX

这些 private-like fixture 与真实公开 Huawei PDF 必须在 authority 上分开，不得把 synthetic 证据升级为真实企业 Fact。
