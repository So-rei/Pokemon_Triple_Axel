//トリプルアクセル基本性能値
var HIT_PER = [0.10,0.09,0.081,0.729,0,0];//0発目HIT率~n発目HIT率 0発目=わざの基本miss率
var HIT_VAL = [20,40,60,0,0];//1発目~n発目威力
var Crit_Per_Const = 1 / 24;//急所率+0仕様値(7,8世代)
//入力値-敵
var Enemy_Item_Per = 4096;//敵アイテム補正率
var Enemy_A = 189;//敵攻撃実数値
var Enemy_Rank = 0;//敵攻撃ランク
var Enemy_Type = false;//タイプ一致フラグ 
//入力値-味方
var Party_Item_Id = 0;//自アイテム補正
var Party_B = 150;//味方防御実数値
var Party_Rank = 0;//味方防御ランク
//その他
var Ret_Type_per = 1.0;//最終的なタイプ相性
var Crit_Per = 1 / 24;//急所率
var CUT_DIGIT = 6;//浮動小数点の見た目が悪いので対策　確率計算後、小数点第n位で四捨五入して表示する

//テストコード表示用■■■
var ret = document.getElementById("RET");
ret.innerHTML = "";
//-----------------

//グラフ初期ロード
  //「オプション設定」
  var options = {
    title: {    
      display: true,
      text: 'ダメージ確率分布表'
    }
  };
var canvas = document.getElementById('stage');
window.myLine = new Chart(canvas, {
  type: 'line',  //グラフの種類
  data: null,  //表示するデータ
  options: options  //オプション設定
});

//最終的にグラフに渡す配列
var Map_x=[];
var Map_y=[];
//1~n発目のダメージ配列を(通常/急所)でそれぞれ取得
var Ary_Dmg = [];
var Ary_Dmg_Crit = [];

//メイン計算------------------------------------------------------------
function Calc(){
  ret.innerHTML = "";//テストコード表示用■■■
  Map_x = [];
  Map_y = [];
  Ary_Dmg = [];
  Ary_Dmg_Crit = [];
  var DMG_MAX = 0;
  
  ParamSet();//画面からの値セット
  
  //Ary_Dmg[i] = i発目のダメージ16パターン{10.....,11....,12}のような配列を取得
  //Ary_Dmg_Crit = 急所時の〃
  for (let i = 0; i < 3; i++){
    Ary_Dmg.push(CalcDmg(HIT_VAL[i]));
    ret.innerHTML += '<div class="log">' + Number(i+1) + '発目=' + Ary_Dmg[i].join(',') + '</div>';//ログ出力■■■
    
    if (Crit_Per > 0){
      Ary_Dmg_Crit.push(CalcDmg(HIT_VAL[i],true));
      ret.innerHTML += '<div class="log">' + Number(i+1) + '発目(' + '<p class=" log red">急所</p>' +
        ')=' + Ary_Dmg_Crit[i].join(',') + '</div>';//ログ出力■■■
    }
    
    if (i==0 && Party_Item_Id == "1")//アッキの実　１回目終了後発動
      Party_Rank = Number(Party_Rank + 1) > 6 ? 6 : Number(Party_Rank + 1);
  }  
  
  //最大ダメージまでの配列を用意する
  for (let i = 0; i < 3; i++){
    if (Crit_Per == 0){
      DMG_MAX += Ary_Dmg[i][15];
    }else{
      DMG_MAX += Ary_Dmg_Crit[i][15];
    }
  }
  for (let i = 0; i <= DMG_MAX; i++){
    Map_x.push(i);//x軸値=名称(0,1,...)
    Map_y.push(0);//y軸値=クリア
  }
  
  //0~i発ぶんHITしたときの確率とダメージ量を計算し、Map_yにセット
  var ptn = [];//0~i回目の合計ダメージ配列
  for (let i = 0; i < 4; i++){
      if (i==0)
        ptn.push([[0,100]]);//0発目Miss初期配列
      else{
        //i-1回目の合計ダメージ配列から、iHIT後の合計ダメージ配列を計算
        ptn.push(RerollCalc(i-1,ptn[i-1]));
      }
      //[ダメージ数1,確率1],...[]の2次元配列 To Map_y
      for (let d = 0; d < ptn[i].length; d++){
        Map_y[ptn[i][d][0]] += HIT_PER[i] * ptn[i][d][1];
      }
  }
  
  //グラフ描画[合計Ver]
  var Map_y_sum = [];
  var y_sum = 0.000;
  for (let i = 0; i <= DMG_MAX; i++){
    y_sum += Map_y[i];
    Map_y_sum.push(Cut_Floor(y_sum));
  }  
  //グラフ描画[正規分布Ver]
  for (let i = 0; i <= DMG_MAX; i++){
    Map_y[i] = (Cut_Floor(Map_y[i]));
  }
  
  //描画
  GlaphDraw(Map_x,Map_y,Map_y_sum);
}

//入力された値を設定
function ParamSet(){
  if (document.getElementById( "Ret_ignore_crit" ).checked == true)
    Crit_Per = 0;
  else
    Crit_Per = Crit_Per_Const;
  let element1 = document.getElementById( "Party_Item" ) ;
  Party_Item_Id　= element1.Party_Item.value;
  let element2 = document.getElementById( "Enemy_Item" ) ;
  Enemy_Item_Per　= element2.Enemy_Item.value;
  let element3 = document.getElementById( "Ret_Type" ) ;
  Ret_Type_per　= element3.Ret_Type.value;
  Enemy_A = Number(document.getElementById( "Enemy_A" ).value);
  Enemy_Rank = Number(document.getElementById("Enemy_Rank").value);
  Enemy_Type = (document.getElementById( "Enemy_Type" ).checked == true);
  Party_B = Number(document.getElementById( "Party_B" ).value);
  Party_Rank = Number(document.getElementById("Party_Rank").value);
}

//被ダメージ量の計算式
//input: val:威力 IsCrit=trueのとき急所
//output: [[DMG1,確率1],[DMG2,確率2]...]の2次元配列
function CalcDmg(val,IsCrit=false){
  let res = [];
  //ダメージ = 攻撃側のレベル × 2 ÷ 5 ＋ 2 → 切り捨て
  //　× 物理技(特殊技)の威力 × 攻撃側のこうげき(とくこう) ÷ 防御側のぼうぎょ(とくぼう) → 切り捨て
  //　÷ 50 ＋ 2 → 切り捨て
  //　× 乱数(0.85, 0.86, …… ,0.99, 1.00 の何れか) → 切り捨て
  //A,Bはランク補正も入る(その度切り捨て)
  
  let final_A = 1;
  if (IsCrit && Enemy_Rank < 0) {
    final_A = Enemy_A; 
  }else if (Enemy_Rank >= 0 ) {//攻撃ランク補正
    final_A = Math.floor(Enemy_A * (Enemy_Rank + 2) / 2);
  }else{
    final_A = Math.floor(Enemy_A * 2 / (-1) * (Enemy_Rank - 2));
  }
  //final_A = Math.floor(final_A * 6144 / 4096);//はりきり
  if (Enemy_Item_Per == "6144")//ハチマキorメガネ
    final_A = Math.round(final_A * 6144 / 4096);//ハチマキorメガネ
  //final_A = Math.floor(final_A * 1.0);//攻撃特性
  let final_B = 1;//防御ランク補正
  if (IsCrit && Party_Rank > 0) {
    final_B = Party_B; 
  }else if (Party_Rank >= 0) {
    final_B = Math.floor(Party_B * (Party_Rank + 2) / 2);
  }else{
    final_B = Math.floor(Party_B * 2 / (-1) * (Party_Rank - 2));
  }
  if (Party_Item_Id == "2")
    final_B = Math.floor(final_B * 1.5);//しんかのきせき 厳密には5捨5超入だが省略
  
  let d = 22;
  d = Math.floor(d * val * final_A / final_B);
  d = Math.floor(d / 50 + 2);
  if (IsCrit) 
    d = Math.floor(d * 6144 / 4096);//急所
  
  for (let i = 0; i < 16; i++){
    let d_one = Math.floor(d * (0.85 + i / 100));//乱数
    if (Enemy_Type == true)
      d_one = Math.floor(d_one * 6144 / 4096);//攻撃側タイプ一致補正
    d_one = Math.floor(d_one * Ret_Type_per);//タイプ相性補正
    if (Enemy_Item_Per != "6144") 
      d_one = Math.floor(d_one * Enemy_Item_Per / 4096);//アイテム補正
    if (d_one == 0) 
      d_one = 1;
    res.push(d_one);
  }
  return res;
}

//n-1HIT中の合計ダメージ配列から、nHIT後の合計ダメージ配列を計算
//[ダメージ数1,確率1],...[]の2次元配列
function RerollCalc(k,parent){
  var ptn = [];//戻り値格納場所
  
  for (let i = 0; i < parent.length; i++){
    for (let p = 0; p < 16; p++){
      let Index = ptn.findIndex(t=> t[0] == (parent[i][0] + Ary_Dmg[k][p]));
      let PerOne = parent[i][1] / 16 * (1 - Crit_Per);
      if (Index != -1){
        //親の確率 * 1/16 * (1-急所率)
        ptn[Index][1] += PerOne;
      }else{
        ptn.push([parent[i][0] + Ary_Dmg[k][p], PerOne]);
      }
      //急所の場合
      if (Crit_Per != 0){
        let IndexCri = ptn.findIndex(s=> s[0] == (parent[i][0] + Ary_Dmg_Crit[k][p]));
        let PerCri = parent[i][1] / 16 * Crit_Per;
        if (IndexCri != -1)
          ptn[IndexCri][1] += PerCri;
        else
          ptn.push([parent[i][0] + Ary_Dmg_Crit[k][p], PerCri]);
      }
    }
  }
  return ptn;
}

//浮動小数点対策
function Cut_Floor(d){
  return Math.round(d * Math.pow(10,CUT_DIGIT)) / Math.pow(10,CUT_DIGIT);
}


//以下グラフ表示用------------------------------------------
function GlaphDraw(labeldata,ydata,ydata_sum){
  var mydata = {
    labels: labeldata,
    datasets: [
      {
        label: '最終DMGがこの値になる確率',
        backgroundColor: 'rgba(255,3,255,0.1)',
        borderColor: 'rgba(255,3,255,0.1)',
        //hoverBackgroundColor: 'rgba(255,3,255,0.1)',
        data: ydata,
        fill: true,
      },
      {
        label: '最終DMGがこの値以下になる確率',
        backgroundColor: 'rgba(0,0,0,0.1)',
        //hoverBackgroundColor: 'rgba(255,99,132,0.3)',
        data: ydata_sum,
        fill: false,
      }
    ]
  };
  //var mydata = {
  //  labels: labeldata,
  //  datasets: [
  //    {
  //      label: '確率<分布>',
  //      hoverBackgroundColor: "rgba(255,99,132,0.3)",
  //      data: ydata,
  //    }
  //  ]
  //};
  window.myLine.data = mydata;
  
  window.myLine.update();//描画更新
}

window.onload = function() {
};
