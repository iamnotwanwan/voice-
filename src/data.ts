export type StageId = 'startup' | 'virtual_expo' | 'opening' | 'part1' | 'part2' | 'ending';

export interface StageInfo {
  id: StageId;
  title: string;
  timeTag: string;
  startTimeMs: number;
  durationMs: number;
  text: string[];
}

export interface SyncState {
  text: string;
  stageTitle: string;
  timeTag: string;
  isAI: boolean;
  typewriter: boolean;
  clear?: boolean;
}

export const STAGES: StageInfo[] = [
  {
    id: 'startup',
    title: '黑场启动',
    timeTag: '00:00',
    startTimeMs: 0,
    durationMs: 30000,
    text: [
      "各位老师、同学，大家好。",
      "欢迎进入《合奏 Ensemble》的现场。",
      "现在，屏幕即将从黑场启动。",
      "低频正在加载，画面正在准备，声音也在慢慢靠近。",
      "请把注意力交给现场。",
      "我们的合奏，即将开始。"
    ]
  },
  {
    id: 'virtual_expo',
    title: '虚拟展馆',
    timeTag: '00:30',
    startTimeMs: 30000,
    durationMs: 180000,
    text: [
      "现在，我们进入《合奏 Ensemble》的虚拟展馆。",
      "请跟随第一视角向前浏览。",
      "你将看到作品的线索、画面的片段，以及这场合奏开始之前的准备过程。",
      "这里不是普通的展示空间，",
      "更像是进入演出之前的一段通道。",
      "请继续向前，",
      "终点处，将是《合奏 Ensemble》正式开启的位置。"
    ]
  },
  {
    id: 'opening',
    title: '开幕式',
    timeTag: '03:30',
    startTimeMs: 210000,
    durationMs: 90000,
    text: [
      "欢迎来到《合奏 Ensemble》。",
      "这是一场由声音、视觉、交互和现场流程共同组成的视觉交互表演。",
      "我们把整个作品分成两个部分。",
      "第一部分，叫做「声成」。",
      "它从输入开始，经过生成、合奏，最终形成一个被定格的 Output。",
      "第二部分，叫做「回响」。",
      "它从报错开始，进入调试、成长，最后完成对主题的再次回应。",
      "接下来，",
      "请和我们一起进入这场正在生成的合奏。"
    ]
  },
  {
    id: 'part1',
    title: 'Part 1：声成',
    timeTag: '05:00',
    startTimeMs: 300000,
    durationMs: 600000,
    text: [
      "现在进入 Part 1，声成。",
      "在这一部分里，声音不只是被播放出来，",
      "它会成为视觉和交互生成的起点。",
      "我们从 Input 开始。",
      "观众的输入、现场的声音、画面的变化，",
      "都会进入这个系统之中。",
      "随后，生成开始。",
      "不同的元素被触发、组合、叠加，",
      "就像不同的声部逐渐加入同一段旋律。",
      "当视觉、音乐和交互共同发生时，",
      "它们不再是分开的部分，",
      "而是在现场形成一次合奏。",
      "最后，作品会进入 Output 定格。",
      "这一刻，是生成过程留下的结果，",
      "也是第一部分「声成」的完成。"
    ]
  },
  {
    id: 'part2',
    title: 'Part 2：回响',
    timeTag: '15:00',
    startTimeMs: 900000,
    durationMs: 240000,
    text: [
      "现在进入 Part 2，回响。",
      "如果说第一部分是生成，",
      "那么第二部分就是回应。",
      "作品从报错开始。",
      "系统出现偏差，画面产生变化，声音也开始变得不稳定。",
      "但报错并不是结束，",
      "它是新的开始。",
      "接下来，是调试。",
      "我们重新整理声音、画面和交互之间的关系，",
      "让系统在变化中找到新的节奏。",
      "然后，是成长。",
      "作品不再只是顺利运行，",
      "它开始带着过程中的问题、调整和反馈继续向前。",
      "最后，我们回到《合奏 Ensemble》的主题。",
      "合奏不是所有部分都完全一致，",
      "而是不同的声音、不同的画面、不同的操作，",
      "在不断回应中，找到共同完成作品的方式。"
    ]
  },
  {
    id: 'ending',
    title: '字幕谢幕',
    timeTag: '19:00',
    startTimeMs: 1140000,
    durationMs: 60000,
    text: [
      "感谢大家参与《合奏 Ensemble》的视觉交互活动表演。",
      "今天，我们从黑场启动，",
      "经过虚拟展馆，",
      "进入声成，",
      "再到回响。",
      "声音、视觉、策划和交互，",
      "像不同的声部一样共同出现。",
      "每一次输入，每一次生成，",
      "每一次报错，每一次调试，",
      "都让这场合奏变得更加完整。",
      "感谢大家的观看、聆听和参与。",
      "《合奏 Ensemble》到这里暂时告一段落。",
      "我们下次再见。"
    ]
  }
];
