# FACTS_SOURCES

核对日期：2026-10-05 · 来源仅限一手（官方 GitHub / Hugging Face config.json / 官方 arXiv 论文 / 官方 API 文档 / 官方公告）

| key | 值 | 模型版本 | 来源 | 原文摘录 |
|---|---|---|---|---|
| model_current | DeepSeek-V4.1-Flash（2026-09-10 发布） | DeepSeek-V4.1-Flash | https://deepseek.com/en/news/deepseek-v4-1-flash/ | "DeepSeek-V4.1-Flash" release announcement, 2026-09-10 |
| params_total_b | 552B | DeepSeek-V4.1-Flash | https://deepseek.com/en/news/deepseek-v4-1-flash/ | "a 552B-parameter Mixture-of-Experts model" |
| params_total_b | 671B | DeepSeek-V3 | https://huggingface.co/deepseek-ai/DeepSeek-V3 | 模型卡表格 "Total Parameters 671B" |
| params_active_b | 8B（prefill）/ 16B（decode） | DeepSeek-V4.1-Flash | https://deepseek.com/en/news/deepseek-v4-1-flash/ | "8B active parameters for input/prefill and 16B for output/decode" |
| params_active_b | 37B / token | DeepSeek-V3 | https://arxiv.org/abs/2412.19437 | "671B total parameters with 37B activated for each token" |
| n_routed_experts | 384 | DeepSeek-V4.1-Flash | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | "n_routed_experts": 384 |
| n_routed_experts | 256 | DeepSeek-V3 | https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/config.json | "n_routed_experts": 256 |
| n_shared_experts | 1 | DeepSeek-V4.1-Flash | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | "n_shared_experts": 1 |
| n_shared_experts | 1 | DeepSeek-V3 | https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/config.json | "n_shared_experts": 1 |
| experts_per_token | 6 | DeepSeek-V4.1-Flash | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | "num_experts_per_tok": 6 |
| experts_per_token | 8 | DeepSeek-V3 | https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/config.json | "num_experts_per_tok": 8 |
| context_length | 1048576（1M） | DeepSeek-V4.1-Flash | https://api-docs.deepseek.com/quick_start/pricing | 表格 "CONTEXT LENGTH 1M" |
| context_length | 131072（128K） | DeepSeek-V3 | https://huggingface.co/deepseek-ai/DeepSeek-V3 | 模型卡表格 "Context Length 128K"（config max_position_embeddings=163840） |
| vocab_size | 129280 | DeepSeek-V4.1-Flash | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | "vocab_size": 129280 |
| vocab_size | 129280 | DeepSeek-V3 | https://huggingface.co/deepseek-ai/DeepSeek-V3/blob/main/config.json | "vocab_size": 129280 |
| num_hidden_layers | 40 | DeepSeek-V4.1-Flash | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | "num_hidden_layers": 40 |
| hidden_size | 5120 | DeepSeek-V4.1-Flash | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/config.json | "hidden_size": 5120 |
| mla_kv_reduction | 93.3% | DeepSeek-V2 | https://arxiv.org/abs/2405.04434 | "MLA ... reduces the KV cache by 93.3%" |
| grpo_group_size | 16 | DeepSeek-R1（R1-Zero RL） | https://arxiv.org/html/2501.12948 | "For each question, we sample 16 outputs with a maximum length of 32,768" |
| r1_release | 2025-01-20 | DeepSeek-R1 | https://api-docs.deepseek.com/zh-cn/news/news250120/ | 官方发布公告，2025-01-20 |
| aha_moment | "Wait, wait. Wait. That's an aha moment I can flag here." | DeepSeek-R1-Zero | https://arxiv.org/html/2501.12948 | 论文 Table 2 模型输出原文 |
| v3_gpu_hours | 2.788M（2,788,000） | DeepSeek-V3 | https://arxiv.org/abs/2412.19437 | "trained ... with 2.788M H800 GPU hours" |
| v3_cost_usd | $5.576M（5,576,000） | DeepSeek-V3 | https://arxiv.org/abs/2412.19437 | "costs only 2.788M H800 GPU hours ... total training cost $5.576M" |
| recommended_temperature | 0.6（0.5-0.7） | DeepSeek-R1 | https://huggingface.co/deepseek-ai/DeepSeek-R1 | 模型卡推荐 sampling temperature 0.5-0.7（默认 0.6） |
| recommended_temperature | 1.0（API 默认） | DeepSeek API（deepseek-flash） | https://api-docs.deepseek.com/zh-cn/quick_start/parameter_settings/ | API 默认 temperature=1.0，按场景给建议值 |
| recommended_top_p | 0.95 | DeepSeek-R1 | https://huggingface.co/deepseek-ai/DeepSeek-R1 | 模型卡推荐 top_p 0.95 |
| recommended_top_p | 1.0（API 默认） | DeepSeek API（deepseek-flash） | https://api-docs.deepseek.com/zh-cn/quick_start/parameter_settings/ | API 默认 top_p=1.0 |
| api_cache_pricing | 命中 $0.003/$0.006，未命中 $0.15/$0.3（谷/峰，每 1M tokens） | deepseek-flash（DeepSeek-V4.1-Flash） | https://api-docs.deepseek.com/quick_start/pricing | 表格 CACHE HIT / CACHE MISS 分谷时峰时计价 |
| tokens_sing_a_song | null（见下） | — | — | 本机无外网无法运行官方 tokenizer，官方亦未公布固定分词结果，按规则留空 |

## 界面文案（无需出处，按社区熟知写法）

| 项 | 写法 |
|---|---|
| 深度思考 | 深度思考 |
| 已深度思考（用时 N 秒） | 已深度思考（用时 N 秒） |
| 联网搜索 | 联网搜索 |
| 给 DeepSeek 发送消息 | 给 DeepSeek 发送消息 |
| 服务器繁忙，请稍后再试。 | 服务器繁忙，请稍后再试。 |
| 内容由 AI 生成，请仔细甄别 | 内容由 AI 生成，请仔细甄别 |
| 我是 DeepSeek，很高兴见到你！ | 我是 DeepSeek，很高兴见到你！ |

## null 说明

- `tokens_sing_a_song`：环境无外网，无法加载 DeepSeek 官方 tokenizer 实际运行分词；官方未公布该句固定 token 数，任何数字都属估计，故按「不许估计」规则留 `null`。

## 与线索文件（facts.py）不一致之处

- 层数：线索 43 层（V4-Flash config）→ 当前主力 DeepSeek-V4.1-Flash 为 **40 层**（官方 config.json）。
- 隐藏维度：线索 4096 → 当前 DeepSeek-V4.1-Flash 为 **5120**。
- 路由专家数：线索 256（V4-Flash）→ 当前 DeepSeek-V4.1-Flash 为 **384**。
- API 缓存计价：线索 DISK_CACHE_HIT=56.3、峰时窗口 (9,12)/(14,18) → 官方 pricing 页为命中 $0.006（峰）/$0.003（谷）、峰时 01:00-04:00 与 06:00-10:00 UTC。
- 与线索一致：上下文 1M、共享专家 1、每 token 6 专家、GRPO=16、R1 temp 0.6/top_p 0.95、V3 2.788M GPU hours / $5.576M、aha moment 原文。

## 验收（Claude，2026-10-05）

直接打开来源核对，全部一致：

- V4.1-Flash `config.json`：路由专家 384、共享专家 1、每 token 6 个、40 层、隐藏维度 5120、词表 129280、`max_position_embeddings` 1048576
- 发布公告：2026-09-10，552B MoE，输入激活 8B、输出激活 16B，API 模型名 `deepseek-flash`
- 定价页：上下文 1M；缓存命中 $0.003 / $0.006，未命中 $0.15 / $0.30（谷 / 峰）；峰时 01:00–04:00、06:00–10:00 UTC
- R1 论文 §2.3：每题采样 16 个输出；Table 2：aha moment 原文

删去了 `num_hidden_layers` 下一条查无出处的备注（"20 层 encoder + 20 层 decoder"）。`tokens_sing_a_song` 可以之后用 Hugging Face 上的 tokenizer 补算。

---

## 公式（任务 06，核对 2026-10-07）

对应 `data/formulas.json`（每条含 `check` 字段写原文位置）。除标「梗 / 演出」外全部 `verified: true`。

| id | 公式（文字描述） | 来源 | 原文位置 | 与库里写法的差异 |
|---|---|---|---|---|
| lm | 自回归语言模型 P(y\|x)=∏_t P(y_t\|y_<t,x) | Jurafsky & Martin《Speech and Language Processing》(SLP3)；Bengio et al. 2003 JMLR | SLP3 §15 式(15.6)；Bengio 式(1) | 无 |
| lm_sub | 同上（代入槽） | 同 lm | 同上 | 槽内为演出值 |
| argmax | 贪心解码 ŷ=argmax_w p(w\|·) | Jurafsky & Martin SLP3 | §15 式(15.7) | 无 |
| sft | SFT 负对数似然 −Σ_t log p(y_t\|x,y_<t) | SLP3；DeepSeek-R1 arXiv:2501.12948 | SLP3 §7 式(7.7)；R1 §2.2 冷启动 SFT | 库里省略了 1/T 平均，语义不变 |
| dft | 离散傅里叶变换 X_k=Σ x_n e^{−2πikn/N} | MathWorld | Discrete Fourier Transform 式(3) | 归一化 / 指数符号属约定，采用前向 e^{−2πikn/N} |
| grpo_adv | GRPO 组内优势 A_i=(r_i−mean)/std | DeepSeek-R1 arXiv:2501.12948；DeepSeekMath arXiv:2402.03300 | R1 §2.1 式(3)；DeepSeekMath §4.1.2 | **改写法**：`\hat{A}_i` → `A_i`（R1 原文无 hat） |
| grpo_sub | 同上（代入槽） | 同 grpo_adv | 同上 | 同上；槽内为演出值 |
| fp8 | FP8 E4M3 规格化数 (−1)^s·2^{e−7}·(1+m/8) | OCP OFP8 R1.0；Micikevicius et al. arXiv:2209.05433；DeepSeek-V3 arXiv:2412.19437 | OCP §4.1；arXiv:2209.05433 Table 1；V3 §3.3.2 "E4M3 on all tensors" | 式只描述规格化数，未含次正规数 / 特殊值（E4M3 无 inf、仅一个 NaN） |
| cos | 余弦相似度 cosθ=u·v/(\|u\|\|v\|) | MathWorld | Dot Product 式(1) | 由 a·b=\|a\|\|b\|cosθ 变形 |
| w2v_king | king−man+woman≈queen | Mikolov et al. 2013 arXiv:1301.3781 | §1 导言；§5 表格 | 原文是文字 / 表格表述，非线性等式 |
| w2v_ai | AI−A≈I | 梗，仿 w2v_king | — | 无需出处 |
| sgd | 梯度下降 θ_{t+1}=θ_t−η∇L(θ_t) | Boyd & Vandenberghe《Convex Optimization》 | §10.1（Δx:=−∇f(x)） | 无 |
| mla | MLA 的 KV 压缩 c_t^KV=W^{DKV}h_t | DeepSeek-V2 arXiv:2405.04434 | §2.1.2 式(9) | 无 |
| mla_k | MLA 的 K 还原 k_t^C=W^{UK}c_t^KV | DeepSeek-V2 arXiv:2405.04434 | §2.1.2 式(10) | 无 |
| heart | 心形线 (x²+y²−1)³−x²y³=0 | MathWorld | Heart Curve（first heart curve） | 无 |
| bpm_a | f=150/60 Hz | 本曲 150 BPM（项目方案 §2.1） | — | 演出值 |
| bpm_b | f=2.5 Hz | 同上 | — | 演出值 |
| psi | 叠加态 \|ψ⟩=Σ_k α_k\|k⟩ | Feynman Lectures Vol.III Ch.1；牛津 QM 讲义 | 牛津 QM 讲义式(21) | 无 |
| born | 玻恩规则 p_k=\|α_k\|² = 温度 softmax | Feynman Vol.III Ch.1；Hinton et al. 2015 arXiv:1503.02531 | Feynman §1-5；Hinton §2 | 等号右端是演出上的类比，两者并非同一数学对象 |
| spring | 欠阻尼解 x(t)=A e^{−γt} cos(ωt) | MathWorld | Damped Simple Harmonic Motion 式(1) | 通解含 B sinωt，取 B=0；字母记号与 MathWorld 不同 |
| nan | L=NaN | 梗 | — | 无需出处 |
| softmax_T | 温度 softmax p_i=e^{z_i/T}/Σ_j e^{z_j/T} | Hinton et al. 2015 arXiv:1503.02531 | §2 | 原文用 q_i |
| attn | 缩放点积注意力 softmax(QKᵀ/√d_k)V | Vaswani et al. 2017 arXiv:1706.03762 | §3.2.1 式(1) | 无 |
| moe_s | MoE 亲和度 s_{i,t}=Sigmoid(u_tᵀ e_i) | DeepSeek-V3 arXiv:2412.19437 | §2.1.2 式(15) | **改写法**：`\mathbf{u}_t^{\top}` → `\mathbf{u}_t^{T}`（原文用上标 T） |
| moe_gate | 无辅助损失的 Top-K 路由 g'_{i,t} | DeepSeek-V3 arXiv:2412.19437 | §2.1.2 式(16) | **改写法**：`\le` → `\leqslant`；b_i 只用于选 Top-K，不进门控值（式(13) 取 s_{i,t}） |
| grpo_obj | GRPO 目标（min/clip/KL） | DeepSeek-R1 arXiv:2501.12948 | §2.1 式(1)（KL 项式(2)） | 库里省略期望符号 E（原文式(1)含 \mathbb{E}），语义不变 |
| mtp | 多 token 预测损失 (λ/D)Σ_k L_MTP^k | DeepSeek-V3 arXiv:2412.19437 | §2.2 式(25)（单层损失式(24)） | **改写法**：`\mathrm{MTP}` → `\text{MTP}`（视觉相同） |

### 任务 06 说明

- R1 的 GRPO 在 **§2.1**（Group Relative Policy Optimization），**不存在 §2.2.1**；§2.2 是 Reward Design。库里的 source 指向正确，仅节号需以此为准。
- `grpo_obj` 原文式(1) **带期望符号**，库里省略；省略不改变含义（目标本身即期望）。
- 记号对齐的 5 条（grpo_adv、grpo_sub、moe_s、moe_gate、mtp）已按原文改 `tex`，均保留原 `\class` / `\cssId` 标签与槽位。
- 逐字核对上的保留：DFT（MathWorld 公式为图片，采用前向约定）、欠阻尼解（MathWorld 图片 + 字母记号不同，欠阻尼通解取 B=0）、Feynman 官网被反爬拦截（改用牛津 QM 讲义逐字核对）。