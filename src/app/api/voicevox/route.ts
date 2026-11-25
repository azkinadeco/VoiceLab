import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/storage';

export const runtime = 'nodejs';

export interface VoicevoxStyleOption {
  id: number;
  speakerName: string;
  styleName: string;
  label: string;
}

const SPEAKER_NAME_MAP: Record<string, string> = {
  '四国めたん': 'Shikoku Metan (Tsundere/Elegan)',
  'ずんだもん': 'Zundamon (Imut/Ceria)',
  '春日部つむぎ': 'Kasukabe Tsumugi (Gyaru/Enerjik)',
  '雨晴はう': 'Amehare Hau (Lembut/Manis)',
  '波音リツ': 'Namine Ritsu (Kuat/Dewasa)',
  '玄野武宏': 'Kurono Takehiro (Pria Muda)',
  '白上虎太郎': 'Shirakami Kotaro (Remaja Pria)',
  '青山龍星': 'Aoyama Ryusei (Pria Berat)',
  '冥鳴ひまり': 'Meimei Himari (Misterius/Lembut)',
  '九州そら': 'Kyushu Sora (Dewasa/Ramah)',
  'もち子さん': 'Mochiko-san (Tenang/Anggun)',
  '剣崎雌雄': 'Kenzaki Mesuo (Pria Tenang)',
  'WhiteCUL': 'WhiteCUL (Dingin/Cool)',
  '後鬼': 'Goki (Tegas/Wibawa)',
  'No.7': 'No.7 (Elegan/Narrator)',
  'ちび式じい': 'Chibishiki Jii (Kakek)',
  '櫻歌ミコ': 'Ouka Miko (Loli/Ceria)',
  '小夜/SAYO': 'SAYO (Lembut/Polos)',
  'ナースロボ＿タイプＴ': 'Nurse Robo Type-T (Tenang/AI)',
  '†聖騎士 紅桜†': 'Ksatria Benizakura (Heroik)',
  '雀松朱司': 'Wakamatsu Akashi (Pria Santai)',
  '麒ヶ島宗麟': 'Kigashima Sorin (Pria Wibawa)',
  '春歌ナナ': 'Haruka Nana (Ceria/Imut)',
  '猫使アル': 'Nekotsuka Aru (Kucing/Santai)',
  '猫使ビィ': 'Nekotsuka Bee (Kucing/Imut)',
  '中国うさぎ': 'Chugoku Usagi (Pemalu/Lembut)',
  '栗田まろん': 'Kurita Maron (Pria Ramah)',
  'あいえるたん': 'Aierutan (Ceria/Idol)',
  '満別花丸': 'Manbetsu Hanamaru (Ramah/Ceria)',
  '琴詠ニア': 'Kotoyomi Nia (Halus/Kalem)',
};

const STYLE_NAME_MAP: Record<string, string> = {
  'ノーマル': 'Normal',
  'あまあま': 'Manis / Imut',
  'ツンツン': 'Tsundere / Galak',
  'セクシー': 'Dewasa / Godaan',
  'ささやき': 'Bisikan',
  'ヒソヒソ': 'Pelan / Rahasia',
  'たのしい': 'Senang',
  'かなしい': 'Sedih',
  'びえーん': 'Menangis',
  'おこ': 'Marah',
  'びくびく': 'Takut / Gugup',
  'ヘロヘロ': 'Lelah',
  'なみだめ': 'Berkaca-kaca',
  '喜び': 'Bahagia',
  'ツンギレ': 'Ngambek',
  '悲しみ': 'Sedih',
  '怒り': 'Marah',
  '熱血': 'Bersemangat',
  '不機嫌': 'Kesal',
  '囁き': 'Bisikan',
  'のんびり': 'Santai',
  'うきうき': 'Bersemangat',
  'おちつき': 'Tenang',
  '人見知り': 'Pemalu',
  'おどろき': 'Kaget',
  'こわがり': 'Takut',
  'へろへろ': 'Lemas',
  'アナウンス': 'Penyiar',
  '読み聞かせ': 'Dongeng',
  '楽々': 'Santai',
  '恐怖': 'Ngeri',
  '内緒話': 'Bisik Rahasia',
  '人間ver.': 'Versi Manusia',
  'ぬいぐるみver.': 'Versi Boneka',
  '第二形態': 'Mode Kedua',
  'ロリ': 'Imut / Loli',
  'クイーン': 'Ratu / Elegan',
  '元気': 'Enerjik',
  'ぶりっ子': 'Manja',
  'ボーイ': 'Tomboy',
  '低血圧': 'Lesu',
  '覚醒': 'Mode Serius',
  '実況風': 'Komentator',
  'おどおど': 'Gugup',
  'ぼそぼそ': 'Bergumam',
};

function translateSpeaker(name: string): string {
  return SPEAKER_NAME_MAP[name] || name;
}

function translateStyle(style: string): string {
  return STYLE_NAME_MAP[style] || style;
}

export async function GET(request: NextRequest) {
  const customUrl = request.nextUrl.searchParams.get('url');
  const appSettings = getAppSettings();
  const baseUrl = (customUrl || appSettings.voicevoxUrl || process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').replace(
    /\/+$/,
    ''
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const [verRes, spkRes] = await Promise.all([
      fetch(`${baseUrl}/version`, { signal: controller.signal }),
      fetch(`${baseUrl}/speakers`, { signal: controller.signal }),
    ]);

    if (!verRes.ok || !spkRes.ok) {
      return NextResponse.json({
        online: false,
        baseUrl,
        error: `VOICEVOX merespons HTTP ${verRes.status}/${spkRes.status}`,
        speakers: [],
      });
    }

    const version = (await verRes.text()).replace(/"/g, '').trim();
    const rawSpeakers: any[] = await spkRes.json();
    const speakers: VoicevoxStyleOption[] = [];

    for (const spk of rawSpeakers) {
      const rawName = spk?.name || 'Speaker';
      const name = translateSpeaker(rawName);
      for (const st of spk?.styles || []) {
        if (typeof st?.id === 'number') {
          const styleName = translateStyle(st.name || 'Normal');
          speakers.push({
            id: st.id,
            speakerName: name,
            styleName,
            label: `${name} — ${styleName}`,
          });
        }
      }
    }

    return NextResponse.json({
      online: true,
      baseUrl,
      version,
      count: speakers.length,
      speakers,
    });
  } catch {
    return NextResponse.json({
      online: false,
      baseUrl,
      downloadUrl: 'https://voicevox.hiroshiba.jp/',
      speakers: [],
    });
  } finally {
    clearTimeout(timer);
  }
}
