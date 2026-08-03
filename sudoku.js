(function () {
  'use strict';

  const baseSolution = '1234341221434321';
  const basePuzzles = [
    '1000341000404301','0034041001430300','1030001201034300','1004000021034021',
    '1004341200034000','0234300021004020','0230040201030320','0230040000430321',
    '0000301220034301','1200040001430021','0200301220434000','0004341021400300'
  ];

  function shuffled(values) {
    const array = values.slice();
    for (let i=array.length-1;i>0;i-=1) {
      const j = Math.floor(Math.random()*(i+1));
      [array[i],array[j]] = [array[j],array[i]];
    }
    return array;
  }

  function transformPair(puzzle,solution) {
    const digits = shuffled(['1','2','3','4']);
    const map = {'1':digits[0],'2':digits[1],'3':digits[2],'4':digits[3],'0':'0'};
    let p = puzzle.split('').map((value) => map[value]).join('');
    let s = solution.split('').map((value) => map[value]).join('');
    if (Math.random()>.5) {
      const rotate = (str) => str.split('').reverse().join('');
      p = rotate(p); s = rotate(s);
    }
    if (Math.random()>.5) {
      const transpose = (str) => {
        const out = Array(16).fill('0');
        for (let r=0;r<4;r+=1) for (let c=0;c<4;c+=1) out[c*4+r] = str[r*4+c];
        return out.join('');
      };
      p = transpose(p); s = transpose(s);
    }
    return {puzzle:p,solution:s};
  }

  function generate() {
    const puzzle = basePuzzles[Math.floor(Math.random()*basePuzzles.length)];
    return transformPair(puzzle,baseSolution);
  }

  function normalize(value) {
    const string = String(value || '').replace(/[^0-4]/g,'').slice(0,16);
    return string.padEnd(16,'0');
  }

  window.HandelserSudoku = { generate, normalize };
})();
