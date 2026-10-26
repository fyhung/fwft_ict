export const STORIES = [
  {id:'cat',icon:'🐈',zh:'肚餓的小貓',en:'The hungry cat',openingZh:'一隻小貓肚餓了。你找到一些食物。接下來會發生甚麼事？',openingEn:'A little cat is hungry. You find some food. What happens next?',words:['小猫','鱼','吃','给','高兴'],patterns:['…饿了','我给…','…很…']},
  {id:'rain',icon:'☂',zh:'下雨的下午',en:'A rainy afternoon',openingZh:'你和朋友想出去玩，可是下雨了。接下來你們會做甚麼？',openingEn:'You and a friend want to go out, but it starts raining. What will you do next?',words:['朋友','下雨','家','看书','玩'],patterns:['我们…','因为…所以…','…在…']},
  {id:'gift',icon:'🎁',zh:'給朋友的驚喜',en:'A surprise for a friend',openingZh:'你的朋友要來探訪。你想準備一個驚喜。你會準備甚麼？',openingEn:'Your friend is coming to visit. You want to prepare a surprise. What will you make?',words:['朋友','来','准备','水果','喜欢'],patterns:['我想…','我给…','…喜欢…']},
];
export const DEMO = {
  interpretation:{zh:'一個孩子把一條魚給一隻肚餓的小貓。',en:'A child gives a fish to a hungry little cat.',questionZh:'',questionEn:''},
  sentences:[
    {chinese:'小猫饿了。',pinyin:'Xiǎomāo è le.',english:'The little cat is hungry.',tokens:[{text:'小猫',pinyin:'xiǎomāo'},{text:'饿',pinyin:'è'},{text:'了',pinyin:'le'},{text:'。',pinyin:''}]},
    {chinese:'我给小猫一条鱼。',pinyin:'Wǒ gěi xiǎomāo yì tiáo yú.',english:'I give the little cat a fish.',tokens:[{text:'我',pinyin:'wǒ'},{text:'给',pinyin:'gěi'},{text:'小猫',pinyin:'xiǎomāo'},{text:'一条',pinyin:'yì tiáo'},{text:'鱼',pinyin:'yú'},{text:'。',pinyin:''}]},
    {chinese:'小猫很高兴。',pinyin:'Xiǎomāo hěn gāoxìng.',english:'The little cat is happy.',tokens:[{text:'小猫',pinyin:'xiǎomāo'},{text:'很',pinyin:'hěn'},{text:'高兴',pinyin:'gāoxìng'},{text:'。',pinyin:''}]},
  ],
};
