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
| 💾 **Nhớ cài đặt** | Bật/tắt tính năng nào thì giữ nguyên ở các session sau. |

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
| `/mods sessions` | Panel các session đang chạy |
| `/mods dash` | Bảng hoạt động |
| `/mods prompts` | Prompt nhanh |
| `/mods save <prompt>` | Lưu một prompt nhanh |
| `/mods version` | Phiên bản đang dùng và tag mới nhất |
| `/mods update` | Cập nhật lên tag mới nhất, xong tự chạy `/reload-plugins` |
| `/mods band` · `cards` · `tldr` · `notify` · `sound` · `voice` · `guard` · `decor` | Bật/tắt từng tính năng |

Mặc định: `sound` và `voice` **tắt**, các tính năng còn lại **bật**.

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
tests/               test cho dải trạng thái, panel, bộ chặn lệnh, update
sounds/done.wav      âm báo khi xong
scripts/release.sh   đánh tag và phát hành
```

## Giới hạn

- Panel Sessions đọc `~/.claude/sessions/*.json`. Đây là định dạng nội bộ của Claude Code, không phải API chính thức; một bản cập nhật Claude Code có thể làm panel trống.
- Mod vẽ **bên trong** giao diện Claude Code. Mod không tạo được cửa sổ riêng, tab hay chia khung kiểu terminal multiplexer, và không chuyển thẳng sang session khác được (dùng nút copy lệnh resume).
- TL;DR gọi thêm Haiku nên tốn thêm một ít token. Tắt bằng `/mods tldr`.
