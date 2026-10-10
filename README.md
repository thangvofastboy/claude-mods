# ✨ claude-mods · terminal-polish

**Mod giúp giao diện terminal của Claude Code gọn gàng và dễ dùng hơn.**

Mod gồm một dải trạng thái phía trên ô prompt, panel danh sách session, bảng hoạt động, prompt nhanh, bộ chặn lệnh nguy hiểm, TL;DR cho câu trả lời dài và thông báo khi Claude làm xong. Mọi thứ dùng qua một lệnh: `/mods`.

Màu sắc lấy theo theme Claude Code bạn đang dùng, nên hợp cả nền sáng lẫn nền tối. Mod không cần dependency và không cần `npm install`.

---

## Tính năng

| Nhóm | Tính năng |
| --- | --- |
| 📟 **Dải trạng thái** | `◆ dự-án ⎇ main ±3 │ ✓ 12s · 5 tool │ ctx 42% $0.31` ngay trên ô prompt: nhánh git, số file đang thay đổi, kết quả lượt trước, mức dùng context (đổi màu khi gần đầy) và chi phí. Bên phải có nút **Session / Bảng / Prompt / Ẩn**. |
| 🗂️ **Sessions** | Các session Claude đang chạy trên máy, tự cập nhật mỗi 3 giây: tên, trạng thái bận/rảnh, thư mục. Có thể **nhắn tin** cho session khác, hoặc **copy lệnh resume** để mở nó ở terminal khác. |
| 📊 **Bảng hoạt động** | Các subagent đang chạy, git, biểu đồ tốc độ 20 lượt gần nhất (`▁▃▇▂`), file Claude đã sửa (**bấm để xem diff có màu**) và các tool gần đây kèm ✓ / ✗. |
| ⚡ **Prompt nhanh** | Lưu những prompt hay dùng thành nút bấm, phím `1`–`9`. Khi Claude đang bận, prompt được xếp hàng và chạy khi rảnh. |
| 🛡️ **Chặn lệnh nguy hiểm** | Chặn `rm -rf /` (hoặc `~`, `*`), force-push lên `main`/`master` (vẫn cho phép `--force-with-lease`), `mkfs`, `dd of=/dev/…`, `chmod -R 777 /`, và việc sửa `.env`, `*.pem`, `id_rsa*` (vẫn cho phép `.env.example`). |
| 📝 **TL;DR** | Câu trả lời dài trên 1200 ký tự được Haiku tóm tắt thành 1–2 câu, hiện ngay bên dưới. |
| 🔔 **Báo khi xong** | Lượt chạy từ 20 giây trở lên: hiện thông báo của hệ điều hành; tuỳ chọn thêm âm thanh hoặc đọc to. |
| 💬 **Thẻ tin nhắn** | Prompt bạn gõ được đóng khung bo góc, dễ phân biệt với câu trả lời. |
| 🎨 **Trang trí** | Spinner tiếng Việt (`Đang nghĩ…`, `Đang chạy tool…`), dòng `✓ Xong sau 12s` và gợi ý `/mods ⚙`. |
| ⚙️ **Tab Cài đặt** | `/mods settings` hoặc nút **Cài đặt**: bật/tắt mọi tính năng bằng một lần bấm, có nút **Bật hết** và **Mặc định**. Cài đặt được giữ ở các session sau. |
| 📈 **Quota & context** | Thanh `5h 34% · 7d 12%` trên dải trạng thái. Khi context từ 85%: nhắc `/compact`, hoặc tự compact nếu bật `autocompact`. |
| 💵 **Thống kê** | `/mods stats`: số lượt, thời gian, tool và chi phí của 7 ngày gần nhất, cùng số liệu hôm nay theo từng dự án. |
| ⌨️ **Từ viết tắt** | `/mods abbrev ;fix Sửa lỗi này và chạy lại test`; sau đó gõ `;fix` trong prompt là tự bung ra. |
| ✂️ **Đoạn bôi đen** | Bôi đen một đoạn trong transcript (chế độ fullscreen) rồi bấm **Chọn** để giải thích, dịch Việt ⇄ Anh, tóm tắt hoặc copy sạch. |
| 📏 **Luật dự án** | `/mods rule luôn dùng pnpm`: luật riêng cho từng dự án, tự thêm vào system prompt. Xem bằng `/mods rules`, xóa bằng `/mods unrule <số>`. |
| 🔔 **Tool cho Claude** | Claude có tool `notify_me` để chủ động báo bạn, cùng 2 subagent `terminal-polish:reviewer` (review, chỉ đọc) và `terminal-polish:tester` (viết và chạy test). |
| ⚡ **Tự chọn model** | *(thử nghiệm, mặc định tắt)* câu hỏi đơn giản tự chạy bằng Haiku. Dải trạng thái hiện `⚡haiku` khi chế độ này được dùng. |
| 📓 **Nhật ký** | Khi đóng session, ghi số lượt, thời gian, chi phí và các file đã sửa vào `~/.claude/mods-journal.md`. |
| 🔎 **Tìm trong hội thoại** | `/mods find <từ khóa>` mở panel kết quả, kèm đoạn văn xung quanh chỗ tìm thấy. |
| ⏱ **Hẹn giờ** | `/mods timer 25`: đếm ngược trên dải trạng thái, hết giờ thì báo. |
| 📦 **Thu gọn output** | Output Bash dài chỉ hiện 3 dòng đầu; bấm vào là mở ra đầy đủ. |
| 🎨 **Theme** | `/mods theme catppuccin \| tokyonight \| dracula \| nord \| gruvbox \| auto` (hoặc chọn trong tab Cài đặt). `auto` theo theme của Claude Code; các theme còn lại dùng bảng màu nền tối chính thức của chúng. |
| 🌈 **Chữ chuyển màu** | Tên dự án, tiêu đề panel và logo ở màn chào được tô chuyển màu theo theme. |
| ▰ **Thanh đo** | Context và quota hiện dạng `ctx ▰▰▰▱▱▱ 42%`, màu chuyển dần từ xanh sang vàng rồi đỏ. |
| 🟢 **Viền theo trạng thái** | Viền dải trạng thái xanh khi rảnh, vàng khi đang chạy, đỏ khi lượt trước lỗi. |
| ⚡ **Powerline** | *(mặc định tắt, cần font Nerd Font)* dải trạng thái thành các khối màu nối bằng ``. |
| ✨ **Hiệu ứng** | Vệt sáng chạy ngang khi Claude đang làm; pháo hoa khi test pass hoặc khi xong một việc dài không lỗi (chỉ trên terminal). |
| 👋 **Màn chào** | Logo chuyển màu, lời chào theo giờ, tóm tắt lần làm việc trước và mẹo dùng. Tự ẩn khi bạn gửi prompt đầu tiên. |
| 🗓️ **Heatmap** | Số lượt mỗi ngày trong 8 tuần, kiểu ô màu GitHub, trong bảng hoạt động. |
| 🏷️ **Nhãn file & thẻ hover** | File đã sửa có nhãn màu theo loại (`TS`, `PY`, `MD`…). Rê chuột lên một dòng tool hoặc file sẽ hiện thẻ chi tiết: lệnh đầy đủ, thời gian chạy, đường dẫn (chế độ fullscreen). |
| 🖼️ **Ảnh** | Logo PNG thật ở màn chào trên terminal hỗ trợ hiển thị ảnh (kitty, Ghostty); terminal khác hiện ký tự thay thế. |
| 🏷️ **Badge tool** | Dòng của các tool một dòng (Bash, Read, Grep, Glob, Agent, Web, MCP) có nhãn màu kèm ✓ / ✗ / ◌. Edit, Write và TodoWrite vẫn giữ cách hiển thị gốc để không mất diff. |

## Cài đặt

Trong Claude Code:

```
/plugin marketplace add thangvofastboy/claude-mods
/plugin install terminal-polish@claude-mods
```

Rồi gõ `/mods` để xem hướng dẫn.

## Bảng lệnh `/mods`

| Lệnh | Tác dụng |
| --- | --- |
| `/mods` | Hướng dẫn và trạng thái bật/tắt của từng tính năng |
| `/mods settings` | Tab cài đặt: bật/tắt nhanh mọi tính năng, chọn theme |
| `/mods theme <tên>` | Đổi bảng màu |
| `/mods sel` | Hành động với đoạn đang bôi đen |
| `/mods find <x>` | Tìm trong hội thoại này |
| `/mods stats` | Thống kê 7 ngày |
| `/mods abbrev [;k nội dung]` | Xem / thêm / xóa (bỏ trống nội dung) từ viết tắt |
| `/mods rule <x>` · `rules` · `unrule <số>` | Luật riêng của dự án |
| `/mods timer <phút>` | Hẹn giờ (không kèm số: hủy) |
| `/mods sessions` | Panel các session đang chạy |
| `/mods dash` | Bảng hoạt động |
| `/mods prompts` | Prompt nhanh |
| `/mods save <prompt>` | Lưu một prompt nhanh |
| `/mods version` | Phiên bản đang dùng và tag mới nhất |
| `/mods update` | Cập nhật lên tag mới nhất, xong tự chạy `/reload-plugins` |
| `/mods <tên tính năng>` | Bật/tắt một tính năng: `band` `cards` `tldr` `notify` `sound` `voice` `guard` `decor` `quota` `autocompact` `abbrev` `rules` `tools` `automodel` `journal` `collapse` `badges` `gradient` `powerline` `meters` `statecolor` `fileicons` `anim` `confetti` `splash` `heatmap` `hovercards` `images` |

Mặc định: `sound`, `voice`, `autocompact`, `automodel` và `powerline` **tắt**, các tính năng còn lại **bật**. Bật/tắt `tools` có hiệu lực từ lần nạp lại plugin tiếp theo.

**Mẹo:**
- Muốn gõ vào ô nhập trong panel (nhắn tin, thêm prompt) thì bấm **ctrl+x tab** để chuyển vào panel, Esc để quay về prompt.
- Ở chế độ fullscreen, terminal rộng từ **110 cột** trở lên thì panel nằm thành sidebar cạnh hội thoại; hẹp hơn thì panel hiện ngay trên ô prompt. Vị trí panel do Claude Code quyết định, mod không đặt được sang trái hay phải.

## Cập nhật và phát hành

Mỗi bản phát hành là một git tag `vX.Y.Z`. `marketplace.json` trên `main` luôn trỏ vào tag mới nhất, nên `/mods update` chỉ cài bản đã được đánh tag, không bao giờ lấy code dở dang trên `main`. Lệnh này chạy lần lượt:

1. `claude plugin marketplace update claude-mods`
2. `claude plugin update terminal-polish@claude-mods`
3. `/reload-plugins` (tự động)

Phát hành bản mới (dành cho người bảo trì):

```bash
scripts/release.sh 0.2.0
```

Script kiểm tra working tree sạch, chạy `claude plugin validate` và `claude plugin test`, nâng version trong `plugin.json`, trỏ `marketplace.json` vào tag mới, commit `chore: release v0.2.0`, đánh tag `v0.2.0` rồi push cả nhánh lẫn tag.

## Phát triển

```bash
claude --plugin-dir .          # chạy Claude Code với mod từ thư mục này (tự nạp lại khi sửa file)
claude plugin validate .       # kiểm tra manifest, hooks và state
claude plugin test .           # chạy tests/*.test.ts(x)
```

```
.claude-plugin/
  plugin.json        manifest của mod
  marketplace.json   catalog, trỏ vào tag mới nhất
hooks/
  hooks.json         khai báo module
  register.tsx       toàn bộ mod
types/index.d.ts     kiểu dữ liệu của $.state
tests/               test cho dải trạng thái, panel, cài đặt, thu gọn output, badge, bộ chặn lệnh, update
sounds/done.wav      âm báo khi xong
assets/logo.png      logo ở màn chào
scripts/release.sh   đánh tag và phát hành
```

## Giới hạn

- Panel Sessions đọc `~/.claude/sessions/*.json`. Đây là định dạng nội bộ của Claude Code, không phải API chính thức; một bản cập nhật Claude Code có thể làm panel trống.
- Mod vẽ **bên trong** giao diện Claude Code. Mod không tạo được cửa sổ riêng, tab hay chia khung kiểu terminal multiplexer, và không chuyển thẳng sang session khác được (dùng nút copy lệnh resume).
- Bộ chặn lệnh là lớp bảo vệ **best-effort** bằng regex, không phải sandbox: nó bắt những cách viết phổ biến, nhưng vẫn lách được (tách cờ `rm -r -f`, bọc trong `sh -c`, dùng biến…). Đừng coi nó thay cho chế độ phân quyền của Claude Code.
- `/mods stats` có thể thiếu vài lượt khi nhiều session cùng ghi một lúc.
- Tự chọn model dùng thêm một lần gọi Haiku ở đầu mỗi lượt để phân loại câu hỏi, và có thể phân loại sai. Vì vậy mặc định tắt.
- Các theme có tên được thiết kế cho nền tối; trên terminal nền sáng thì nên dùng `auto`.
- Màu hex cần terminal hỗ trợ truecolor (tmux cần bật `Tc`/`RGB`). Hiệu ứng vẽ lại khoảng 12 khung hình/giây chỉ trong lúc chạy; tắt bằng `/mods anim` và `/mods confetti` nếu terminal bị nhấp nháy.
- TL;DR gọi thêm Haiku nên tốn thêm một ít token. Tắt bằng `/mods tldr`.
