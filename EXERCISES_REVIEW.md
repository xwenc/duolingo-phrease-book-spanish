# exercises.json 第一页转换样例（待确认）

本次只处理首个练习页：教材第9页 GREETINGS。之前的首张 IMG_20261026_135003 是 ESSENTIALS 导言，没有练习条目，因此未造题。

已交叉核对：
- `docling_output/markdown/IMG_20261026_135010.md`
- `docling_output/documents/IMG_20261026_135010.json`
- `docling_output/ocr/IMG_20261026_135010.txt`

## 转换规则

- 完全沿用原 JSON 对象字段，不新增来源或页码字段；通过 `book-p009-XX` 的 ID 与 `book-p009` 的单元 ID 关联教材页码。
- 原页16行表达，两处斜线选项（Hola/adiós、él/ella）各拆成两题，共18题；保留原页条目顺序和重复表达。
- `spanish` 保留教材表达及 Éste 的旧式重音写法；拆分选项时补全各自问句或感叹号。
- `phonetics` 保留教材的英语式拼读提示，不将其当成西班牙语正文。
- 中文翻译、语法说明和词汇提示为本次补充，并非原书中文。Buenas tardes 按西语含义译为“下午好；傍晚好”。
- 带省略号的句型只录入书中固定部分，不虚构姓名或例句。
- 18道题均设为 easy。原有23道演示题保持不变；样例位于数组开头，总计41道题。
- 已按本次预览要求同步到运行中的 MySQL：新增18题，原23道演示题保留，共41题。同步前题库备份位于 `.local-test/backups/exercises-before-page9.json`。已在浏览器选择第9页单元，确认显示新题目；后续页仍待确认后继续。

## 本页题目

| ID | 西班牙语 | 中文 |
| --- | --- | --- |
| book-p009-01 | Hola | 你好 |
| book-p009-02 | Buenas tardes | 下午好；傍晚好 |
| book-p009-03 | Buenas noches | 晚上好；晚安 |
| book-p009-04 | Adiós | 再见 |
| book-p009-05 | ¡Hola! | 嗨！ |
| book-p009-06 | ¡Adiós! | 再见！ |
| book-p009-07 | Encantado de conocerle | 很高兴认识您 |
| book-p009-08 | ¿Cómo está? | 您好吗？ |
| book-p009-09 | Bien, gracias | 很好，谢谢 |
| book-p009-10 | De nada | 不客气 |
| book-p009-11 | Me llamo... | 我叫…… |
| book-p009-12 | ¿Cómo se llama? | 您叫什么名字？ |
| book-p009-13 | ¿Cómo se llama él? | 他叫什么名字？ |
| book-p009-14 | ¿Cómo se llama ella? | 她叫什么名字？ |
| book-p009-15 | Éste es... | 这位是…… |
| book-p009-16 | Mucho gusto | 很高兴认识您 |
| book-p009-17 | Hasta mañana | 明天见 |
| book-p009-18 | Hasta pronto | 回头见；不久见 |

校验通过：JSON可解析、字段与原格式一致、ID唯一、字段类型及难度合法、词汇提示结构一致；原演示题逐条保留。
