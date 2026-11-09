import type { Lang } from '../types.js'

export const RELEASES: { version: string; date: string; notes: Record<Lang, string[]> }[] = [
  {
    version: '1.0.2',
    date: '2026-11-09',
    notes: {
      tr: [
        'İzin bildirimleri ne istendiğini gösteriyor: sorulan soru, çalıştırılacak komut ya da düzenlenecek dosya.',
        'Claude Code’un İngilizce bildirim metinleri ve önizlemedeki örnekler artık uygulamanın dilinde.',
        'Sürüm notları eklendi.',
      ],
      en: [
        'Permission notifications show what is being asked: the question, the command to run or the file to edit.',
        'Claude Code’s notification texts and the preview samples now follow the app language.',
        'Added release notes.',
      ],
    },
  },
  {
    version: '1.0.1',
    date: '2026-11-05',
    notes: {
      tr: [
        'Uyku ya da ekran kilidinden sonra ekranda takılı kalan bildirimler düzeltildi.',
        'Tam ekran pencere sürüklenince eski boyutuna dönüyor, ekranın üstüne bırakınca yeniden büyüyor.',
        'Güncellemeler artık CDN üzerinden indiriliyor.',
      ],
      en: [
        'Fixed popups that stayed stuck on screen after sleep or screen lock.',
        'A maximized window restores when dragged and maximizes again when dropped at the top of the screen.',
        'Updates now download from a CDN.',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-10-30',
    notes: {
      tr: [
        'Claude Code, Codex, Cursor, Gemini CLI ve OpenCode için masaüstü bildirimleri.',
        'Bitti, izin ve bekliyor bildirimleri; her biri için ayrı başlık, metin, renk ve ses.',
        'Tema, renk, yazı tipi, konum ve animasyon ayarları.',
        'Bildirime tıklayınca ajanın çalıştığı pencereye dönüş.',
        'Windows, macOS ve Linux desteği, otomatik güncelleme.',
      ],
      en: [
        'Desktop notifications for Claude Code, Codex, Cursor, Gemini CLI and OpenCode.',
        'Done, permission and waiting notifications, each with its own title, text, color and sound.',
        'Theme, color, font, position and animation settings.',
        'Click a notification to return to the agent’s window.',
        'Windows, macOS and Linux support with automatic updates.',
      ],
    },
  },
]
