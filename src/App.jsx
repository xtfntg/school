import { useState, useEffect, useRef } from 'react'
import ErrorBoundary from './ErrorBoundary'

// 配置常量
const MAP_CONFIG = {
  center: [116.298056, 39.959912], // 海淀区中心点
  zoom: 12,
  zooms: [9, 18],
  lang: 'zh_cn',
  viewMode: '2D',
  resizeEnable: true,
  mapStyle: 'amap://styles/normal',
  jogEnable: true,
  dragEnable: true,
  keyboardEnable: true,
  doubleClickZoom: true,
  scrollWheel: true
};

const TIER_COLORS = {
  '第一梯队': '#FF0000', // 赤色
  '第二梯队': '#FF7F00', // 橙色
  '第三梯队': '#FFFF00', // 黄色
  '第四梯队': '#00FF00', // 绿色
  '第五梯队': '#00FFFF', // 青色
  '第六梯队': '#0000FF', // 蓝色
  '第七梯队': '#8B00FF', // 紫色
  '第八梯队': '#808080'  // 灰色
};

// 工具函数
const createCustomMarker = (tier, rate) => {
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');

  // 绘制外圈
  ctx.beginPath();
  ctx.arc(25, 25, 23, 0, Math.PI * 2);
  ctx.fillStyle = TIER_COLORS[tier] || '#808080';
  ctx.fill();

  // 绘制黑色文字
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 12px "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 处理中签率显示，只保留数字
  let displayRate = rate;
  if (rate === '100.00') {
    displayRate = '100';
  } else if (rate === '0.00') {
    displayRate = '0';
  } else {
    // 保留一位小数，去掉百分号
    displayRate = parseFloat(rate).toFixed(1);
  }

  ctx.fillText(displayRate, 25, 25);

  return canvas.toDataURL();
};

const generateInfoWindowContent = (school) => {
  const tierColor = TIER_COLORS[school.tier] || '#808080';
  return `
     <div style="padding: 10px; max-width: 300px; font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif;">
      <h3 style="margin: 0 0 10px 0; color: ${tierColor}; border-bottom: 2px solid ${tierColor}; padding-bottom: 5px; font-size: 16px;">
        ${school.name}
      </h3>
      <div style="font-size: 14px; line-height: 1.5;">
        <p style="margin: 5px 0;"><strong>梯队：</strong>${school.tier}</p>
        <p style="margin: 5px 0;"><strong>描述：</strong>${school.description}</p>
        <p style="margin: 5px 0;"><strong>统招线：</strong>${school.score}</p>
        <p style="margin: 5px 0;"><strong>区排名：</strong>${school.districtRank}</p>
        <p style="margin: 5px 0;"><strong>2025年招生：</strong>${school.enrollment2025}人</p>
        <p style="margin: 5px 0;"><strong>报名人数：</strong>${school.applicants}人</p>
        <p style="margin: 5px 0;"><strong>中签率：</strong>${school.acceptanceRate}</p>
        <p style="margin: 5px 0;"><strong>特色优势：</strong>${school.features.advantages}</p>
        <p style="margin: 5px 0;"><strong>升学方向：</strong>${school.features.educationPath.join(' / ')}</p>
        <p style="margin: 5px 0;"><strong>地址：</strong>${school.address}</p>
      </div>
    </div>
  `;
};

const getSchoolLocation = (school) => {
  return school.location || MAP_CONFIG.center;
};

// 添加POI搜索函数
const searchSchoolLocation = async (schoolName, address) => {
  try {
    return new Promise((resolve, reject) => {
      const placeSearch = new window.AMap.PlaceSearch({
        city: '北京',
        citylimit: true,
        pageSize: 1,
        pageIndex: 1
      });

      // 优先使用学校名称搜索
      placeSearch.search(schoolName, (status, result) => {
        if (status === 'complete' && result.info === 'OK' && result.poiList.pois.length > 0) {
          const poi = result.poiList.pois[0];
          console.log(`找到学校: ${schoolName}`, poi.location);
          resolve([poi.location.lng, poi.location.lat]);
        } else {
          // 如果学校名称搜索失败，尝试使用地址搜索
          placeSearch.search(address, (status, result) => {
            if (status === 'complete' && result.info === 'OK' && result.poiList.pois.length > 0) {
              const poi = result.poiList.pois[0];
              console.log(`通过地址找到: ${address}`, poi.location);
              resolve([poi.location.lng, poi.location.lat]);
            } else {
              reject(new Error('未找到位置'));
            }
          });
        }
      });
    });
  } catch (error) {
    console.error('搜索位置错误:', error);
    return null;
  }
};

function App() {
  const [schools, setSchools] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [clickedCoordinates, setClickedCoordinates] = useState(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowsRef = useRef([]);

  const parsedSchools = [
    {
      name: "北京市十一学校",
      tier: "第一梯队",
      address: "玉泉路66号",
      location: [116.255328, 39.902167],
      score: 644,
      districtRank: "前800",
      enrollment2024: 150,
      applicants: 2132,
      acceptanceRate: "7.04%",
      features: {
        advantages: "★选课走班制",
        educationPath: ["高考", "出国双轨"]
      },
      enrollment2025: 150,
      acceptanceRate2025: "7.04%",
      description: "中考 660 分以上 21 人（2024 年），高考清北率超 30%，本部资源强。"
    },
    {
      name: "北京市第一〇一中学 - 借址（冷泉校区）",
      tier: "第七梯队",
      address: "西北旺冷泉东路66号",
      location: [116.229816, 40.030302],
      score: 620,
      districtRank: "前4200",
      enrollment2024: 80,
      applicants: 105,
      acceptanceRate: "76.19%",
      features: {
        advantages: "共享本部资源",
        educationPath: ["国内高考"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "114.29%",
      description: "借址中关村外国语学校冷泉校区，学籍独立，2025 年首届招生，资源待整合。"
    },
    {
      name: "北京市第一〇一中学 - 双榆树校区",
      tier: "第七梯队",
      address: "双榆树东里35号",
      location: [116.327771, 39.968916],
      score: 620,
      districtRank: "前4200",
      enrollment2024: 210,
      applicants: 321,
      acceptanceRate: "65.42%",
      features: {
        advantages: "共享本部资源",
        educationPath: ["国内高考"]
      },
      enrollment2025: 130,
      acceptanceRate2025: "40.5%",
      description: "借址中关村外国语学校冷泉校区，学籍独立，2025 年首届招生，资源待整合。"
    },
    {
      name: "北京市十一学校龙樾实验中学",
      tier: "第二梯队",
      address: "文龙家园三里10号楼",
      location: [116.349388, 40.044932],
      score: 630,
      districtRank: "前2300",
      enrollment2024: 40,
      applicants: 623,
      acceptanceRate: "6.42%",
      features: {
        advantages: "十一系课程共享",
        educationPath: ["高考", "竞赛"]
      },
      enrollment2025: 40,
      acceptanceRate2025: "6.4%",
      description: "十一学校直属分校，课程体系与本部一致，2024 年中考成绩海淀前十。"
    },
    {
      name: "人大附中西山学校",
      tier: "第二梯队",
      address: "马连洼南路9号",
      location: [116.285068, 40.032064],
      score: 625,
      districtRank: "前3500",
      enrollment2024: 80,
      applicants: 205,
      acceptanceRate: "39.02%",
      features: {
        advantages: "★AP国际课程",
        educationPath: ["出国方向为主"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "58.5%",
      description: "借址办学，学籍归属于人大附中，共享本部管理与师资，教学质量接近本部。"
    },
    {
      name: "北京师范大学第三附属中学（北太平庄校区）",
      tier: "第四梯队",
      address: "北三环中路甲36号",
      location: [116.365937, 39.965588],
      score: 618,
      districtRank: "前4500",
      enrollment2024: 280,
      applicants: 160,
      acceptanceRate: "100.00%",
      features: {
        advantages: "艺术教育突出",
        educationPath: ["高考", "艺术生"]
      },
      enrollment2025: 280,
      acceptanceRate2025: "100%",
      description: "文科教学特色，中考海淀前六十，高考本科率 80%+。"
    },
    {
      name: "中国人民大学附属中学分校",
      tier: "第四梯队",
      address: "双榆树南里二区3号",
      location: [116.32743, 39.966113],
      score: 623,
      districtRank: "前3800",
      enrollment2024: 70,
      applicants: 689,
      acceptanceRate: "10.16%",
      features: {
        advantages: "师资共享本部",
        educationPath: ["高考", "出国"]
      },
      enrollment2025: 70,
      acceptanceRate2025: "10.2%",
      description: "民办校，依托人大附中资源，中考成绩海淀前五十，学费较高。"
    },
    {
      name: "北京市八一学校",
      tier: "第二梯队",
      address: "苏州街29号",
      location: [116.304272, 39.977604],
      score: 632,
      districtRank: "前2500",
      enrollment2024: 80,
      applicants: 189,
      acceptanceRate: "42.33%",
      features: {
        advantages: "国防教育特色",
        educationPath: ["国内高考"]
      },
      enrollment2025: 50,
      acceptanceRate2025: "26.5%",
      description: "高考一本率 95%+，中考高分段海淀前十，十二年一贯制办学。"
    },
    {
      name: "北京市中关村中学（2025 年入学的初一年级学生上课地址为中关村中学双榆树校区）",
      tier: "第三梯队",
      address: "本部地址：科学院南路甲14号；双榆树校区地址：双榆树北里25号",
      location: [116.326868, 39.978583],
      score: 625,
      districtRank: "前3500",
      enrollment2024: 120,
      applicants: 386,
      acceptanceRate: "31.09%",
      features: {
        advantages: "科技示范校",
        educationPath: ["高考", "强基计划"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "31.1%",
      description: "2025 年初一新生入驻双榆树校区，本部资源倾斜，中考海淀前二十五。"
    },
    {
      name: "北京航空航天大学实验学校分校（本校、分校一体化管理，初一、初二在本校上课，初三在分校上课）",
      tier: "第七梯队",
      address: "蓟门里小区北甲11号",
      location: [116.351451, 39.972645],
      score: 620,
      districtRank: "前4200",
      enrollment2024: 80,
      applicants: 212,
      acceptanceRate: "37.74%",
      features: {
        advantages: "航空航天特色",
        educationPath: ["强基计划", "高考"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "37.7%",
      description: "本校分校一体化管理，初三在分校上课，借址办学，资源分散，中考成绩靠后。"
    },
    {
      name: "清华附中学院路学校",
      tier: "第三梯队",
      address: "成府路20号",
      location: [116.345175, 39.988174],
      score: 613,
      districtRank: "前5500",
      enrollment2024: 80,
      applicants: 878,
      acceptanceRate: "9.11%",
      features: {
        advantages: "学院路高校资源",
        educationPath: ["国内高考"]
      },
      enrollment2025: 160,
      acceptanceRate2025: "18.2%",
      description: "清华附中直属管理，借址办学，师资共享，中考海淀前四十五，潜力大。"
    },
    {
      name: "清华附中志新学校",
      tier: "第四梯队",
      address: "志新路36号",
      location: [116.363188, 39.99295],
      score: 595,
      districtRank: "前7600",
      enrollment2024: 40,
      applicants: 223,
      acceptanceRate: "17.94%",
      features: {
        advantages: "社区型学校",
        educationPath: ["国内高考"]
      },
      enrollment2025: 220,
      acceptanceRate2025: "98.7%",
      description: "清华附中体系内，借址办学，注重素质教育，中考海淀前六十五。"
    },
    {
      name: "北京一零一中矿大分校",
      tier: "第四梯队",
      address: "学院路丁11号",
      location: [116.347311, 39.998832],
      score: 598,
      districtRank: "前7300",
      enrollment2024: 140,
      applicants: 150,
      acceptanceRate: "93.33%",
      features: {
        advantages: "矿业特色课程",
        educationPath: ["国内高考"]
      },
      enrollment2025: 140,
      acceptanceRate2025: "93.3%",
      description: "101 中学联合培养，部分师资交流，中考海淀前七十，逐步提升。"
    },
    {
      name: "北京一零一中石油分校",
      tier: "第四梯队",
      address: "学院路20号",
      location: [116.362663, 39.998916],
      score: 593,
      districtRank: "前7900",
      enrollment2024: 80,
      applicants: 117,
      acceptanceRate: "68.38%",
      features: {
        advantages: "能源特色课程",
        educationPath: ["国内高考"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "68.4%",
      description: "与 101 中学课程共建，中考海淀前七十五，理科实验课程突出。"
    },
    {
      name: "北京市第一〇一中学",
      tier: "第一梯队",
      address: "颐和园路11号",
      location: [116.304547, 40.00333],
      score: 641,
      districtRank: "前1200",
      enrollment2024: 140,
      applicants: 720,
      acceptanceRate: "19.44%",
      features: {
        advantages: "园林式校园",
        educationPath: ["国内高考"]
      },
      enrollment2025: 140,
      acceptanceRate2025: "19.4%",
      description: "高考一本率 98%+，中考高分段海淀前五，本部管理严格。"
    },
    {
      name: "北京市上地实验学校【借址北京市中关村外国语学校（上地校区），学籍为北京市上地实验学校】",
      tier: "第三梯队",
      address: "昌平区回龙观朱辛庄 321 号",
      location: [116.302736, 40.092095],
      score: 622,
      districtRank: "前4000",
      enrollment2024: 80,
      applicants: 55,
      acceptanceRate: "100.00%",
      features: {
        advantages: "借址但管理严格",
        educationPath: ["国内高考"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "218.2%",
      description: "借址中关村外国语学校上地校区，学籍独立，中考海淀前四十，派位热门。"
    },
    {
      name: "北京市上地实验学校",
      tier: "第三梯队",
      address: "上地二街3号",
      location: [116.308841, 40.034709],
      score: 622,
      districtRank: "前4000",
      enrollment2024: 100,
      applicants: 768,
      acceptanceRate: "13.02%",
      features: {
        advantages: "借址但管理严格",
        educationPath: ["国内高考"]
      },
      enrollment2025: 100,
      acceptanceRate2025: "13.0%",
      description: "借址中关村外国语学校上地校区，学籍独立，中考海淀前四十，派位热门。"
    },
    {
      name: "北京市八一学校附属玉泉中学",
      tier: "第五梯队",
      address: "厢红旗东门外甲3号",
      location: [116.262665, 40.004697],
      score: 603,
      districtRank: "前6800",
      enrollment2024: 120,
      applicants: 78,
      acceptanceRate: "100.00%",
      features: {
        advantages: "八一教育集团支持",
        educationPath: ["国内高考"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "153.8%",
      description: "八一学校分校，独立学籍，借址办学，中考海淀前九十五，资源待整合。"
    },
    {
      name: "北京市第一〇一中学 - 温泉校区",
      tier: "第二梯队",
      address: "温泉镇叠风路17号",
      location: [116.188605, 40.045901],
      score: 615,
      districtRank: "前5000",
      enrollment2024: 200,
      applicants: 221,
      acceptanceRate: "90.50%",
      features: {
        advantages: "寄宿制管理",
        educationPath: ["国内高考"]
      },
      enrollment2025: 150,
      acceptanceRate2025: "67.9%",
      description: "101 中学直属校区，管理统一、师资共享，教学质量接近本部。"
    },
    {
      name: "北京市第二十中学",
      tier: "第三梯队",
      address: "清河小营西路11号",
      location: [116.337432, 40.039214],
      score: 615,
      districtRank: "前5000",
      enrollment2024: 120,
      applicants: 656,
      acceptanceRate: "18.29%",
      features: {
        advantages: "新都校区硬件优",
        educationPath: ["国内高考"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "18.3%",
      description: "新都校区整合后，中考海淀前三十五，理科教学特色明显。"
    },
    {
      name: "北京市清河中学",
      tier: "第五梯队",
      address: "清河一街83号",
      location: [116.346007, 40.031593],
      score: 600,
      districtRank: "前7000",
      enrollment2024: 100,
      applicants: 66,
      acceptanceRate: "100.00%",
      features: {
        advantages: "日语特色课程",
        educationPath: ["高考", "日本留学"]
      },
      enrollment2025: 100,
      acceptanceRate2025: "151.5%",
      description: "区域普通校，中考海淀前一百，艺术特长教育为主，本科率 70%+。"
    },
    {
      name: "北京市二十中学 - 新都校区",
      tier: "第七梯队",
      address: "西三旗新都环岛东",
      location: [116.368138, 40.062366],
      score: 595,
      districtRank: "前7600",
      enrollment2024: 180,
      applicants: 98,
      acceptanceRate: "100.00%",
      features: {
        advantages: "硬件条件优越",
        educationPath: ["国内高考"]
      },
      enrollment2025: 180,
      acceptanceRate2025: "183.7%",
      description: "二十中学旧校区，独立管理，硬件老旧，中考成绩海淀末位。"
    },
    {
      name: "中国农业大学附属中学",
      tier: "第五梯队",
      address: "圆明园西路三号",
      location: [116.275168, 40.022885],
      score: 590,
      districtRank: "前8200",
      enrollment2024: 100,
      applicants: 59,
      acceptanceRate: "100.00%",
      features: {
        advantages: "农业科技特色",
        educationPath: ["高考", "职业导向"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "203.4%",
      description: "依托农大资源，生物 / 农业特色课程，中考海淀前一百零五。"
    },
    {
      name: "北京中法实验学校",
      tier: "第五梯队",
      address: "温泉镇环山村2号院",
      location: [116.20899, 40.038828],
      score: 585,
      districtRank: "前8800",
      enrollment2024: 120,
      applicants: 200,
      acceptanceRate: "60.00%",
      features: {
        advantages: "法语双语教学",
        educationPath: ["高考", "法国留学"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "60.0%",
      description: "中法合作办学，法语特色，中考海淀前一百一十，国际交流项目多。"
    },
    {
      name: "北京市第五十七中学上庄分校",
      tier: "第五梯队",
      address: "上庄镇43号",
      location: [116.218522, 40.100916],
      score: 580,
      districtRank: "前9200",
      enrollment2024: 60,
      applicants: 35,
      acceptanceRate: "100.00%",
      features: {
        advantages: "航空模型特色",
        educationPath: ["国内高考"]
      },
      enrollment2025: 60,
      acceptanceRate2025: "171.4%",
      description: "五十七中分校，借址办学，科技教育特色，中考海淀前一百一十五。"
    },
    {
      name: "清华附中上庄学校",
      tier: "第六梯队",
      address: "上庄镇东小营2号",
      location: [116.215311, 40.121241],
      score: 588,
      districtRank: "前8500",
      enrollment2024: 100,
      applicants: 68,
      acceptanceRate: "100.00%",
      features: {
        advantages: "农村校改造",
        educationPath: ["国内高考"]
      },
      enrollment2025: 100,
      acceptanceRate2025: "147.1%",
      description: "清华附中体系内，借址办学，管理独立，中考海淀前一百二十，师资待加强。"
    },
    {
      name: "清华大学附属中学永丰学校",
      tier: "第二梯队",
      address: "西北旺镇永泽北路6号",
      location: [116.252228, 40.083819],
      score: 605,
      districtRank: "前6500",
      enrollment2024: 50,
      applicants: 142,
      acceptanceRate: "35.21%",
      features: {
        advantages: "北部新区重点校",
        educationPath: ["国内高考"]
      },
      enrollment2025: 90,
      acceptanceRate2025: "63.4%",
      description: "清华附中直接管理，2024 年高考 650 分以上 8 人，中考成绩稳步提升。"
    },
    {
      name: "北京市十一晋元中学【借址北京市十一学校（顺义区杨镇第一中学），学籍为北京市十一晋元中学】",
      tier: "第四梯队",
      address: "顺义区木燕路2号",
      location: [116.816395, 40.154852],
      score: 610,
      districtRank: "前6000",
      enrollment2024: 120,
      applicants: 565,
      acceptanceRate: "21.24%",
      features: {
        advantages: "十一系教学模式",
        educationPath: ["高考", "综合素质评价"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "21.2%",
      description: "借址顺义杨镇一中，学籍独立，共享十一学校部分资源，中考海淀前五十五。"
    },
    {
      name: "首都师范大学附属中学 - 北校区",
      tier: "第四梯队",
      address: "德馨路16号",
      location: [116.26408, 40.044272],
      score: 635,
      districtRank: "前2000",
      enrollment2024: 200,
      applicants: 1023,
      acceptanceRate: "19.55%",
      features: {
        advantages: "★成达教育体系",
        educationPath: ["国内高考"]
      },
      enrollment2025: 130,
      acceptanceRate2025: "12.7%",
      description: "首师大附中直属管理，借址办学，中考海淀前八十，课程同步本部。"
    },
    {
      name: "北京交通大学附属中学实验学校",
      tier: "第三梯队",
      address: "苏家坨镇西小营村",
      location: [116.156837, 40.08138],
      score: 585,
      districtRank: "前8800",
      enrollment2024: 60,
      applicants: 166,
      acceptanceRate: "36.14%",
      features: {
        advantages: "交大资源支持",
        educationPath: ["国内高考"]
      },
      enrollment2025: 60,
      acceptanceRate2025: "36.1%",
      description: "交大附中直属管理，借址办学，中考成绩海淀前三十。"
    },
    {
      name: "北京大学附属中学",
      tier: "第一梯队",
      address: "北京大学畅春园",
      location: [116.320301, 39.978187],
      score: 638,
      districtRank: "前1500",
      enrollment2024: 100,
      applicants: 636,
      acceptanceRate: "15.72%",
      features: {
        advantages: "★书院制管理",
        educationPath: ["高考", "国际方向"]
      },
      enrollment2025: 100,
      acceptanceRate2025: "15.7%",
      description: "素质教育标杆，中考高分段前列，高考清北率 25%+。"
    },
    {
      name: "清华大学附属中学",
      tier: "第一梯队",
      address: "中关村北大街清华大学北侧",
      location: [116.320339, 40.009374],
      score: 647,
      districtRank: "前500",
      enrollment2024: 80,
      applicants: 878,
      acceptanceRate: "9.11%",
      features: {
        advantages: "★马班体育特长",
        educationPath: ["国内高考"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "9.1%",
      description: "高考一本率 99%+，2024 年中考高分段海淀前三，本部管理强。"
    },
    {
      name: "中国人民大学附属中学",
      tier: "第一梯队",
      address: "中关村大街37号",
      location: [116.314491, 39.974751],
      score: 650,
      districtRank: "前300",
      enrollment2024: 80,
      applicants: 912,
      acceptanceRate: "8.77%",
      features: {
        advantages: "★竞赛保送清北",
        educationPath: ["高考", "国际部"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "8.8%",
      description: "全国顶尖，2024 年中考 660 分以上人数海淀第一，高考清北率超 60%。"
    },
    {
      name: "首都师范大学附属中学",
      tier: "第一梯队",
      address: "北洼路33号",
      location: [116.300403, 39.930052],
      score: 635,
      districtRank: "前2000",
      enrollment2024: 20,
      applicants: 656,
      acceptanceRate: "3.05%",
      features: {
        advantages: "★成达教育体系",
        educationPath: ["国内高考"]
      },
      enrollment2025: 20,
      acceptanceRate2025: "3.0%",
      description: "高考清北率 15%+，中考高分段海淀前八，本部教学扎实。"
    },
    {
      name: "北京航空航天大学实验学校（本校、分校一体化管理，初一、初二在本校上课，初三在分校上课）",
      tier: "第三梯队",
      address: "学院路37号",
      location: [116.344317, 39.978947],
      score: 620,
      districtRank: "前4200",
      enrollment2024: 80,
      applicants: 212,
      acceptanceRate: "37.74%",
      features: {
        advantages: "航空航天特色",
        educationPath: ["强基计划", "高考"]
      },
      enrollment2025: 30,
      acceptanceRate2025: "14.2%",
      description: "本校、分校一体化管理，初一初二在本校，中考成绩海淀前二十。"
    },
    {
      name: "清华大学附属实验学校【借址清华大学附属中学（奥森校区），学籍为清华大学附属实验学校】",
      tier: "第三梯队",
      address: "朝阳区林萃路2号",
      location: [116.379543, 40.021468],
      score: 605,
      districtRank: "前6500",
      enrollment2024: 60,
      applicants: 368,
      acceptanceRate: "16.30%",
      features: {
        advantages: "共享清华附资源",
        educationPath: ["国内高考"]
      },
      enrollment2025: 160,
      acceptanceRate2025: "43.5%",
      description: "借址清华附中奥森校区，学籍独立，师资与本部共享，中考海淀前十五。"
    },
    {
      name: "清华大学附属实验学校  学籍校",
      tier: "第三梯队",
      address: "中关村北大街清华大学北侧",
      location: [116.320265, 40.007968],
      score: 605,
      districtRank: "前6500",
      enrollment2024: 60,
      applicants: 368,
      acceptanceRate: "16.30%",
      features: {
        advantages: "共享清华附资源",
        educationPath: ["国内高考"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "21.7%",
      description: "借址清华附中奥森校区，学籍独立，师资与本部共享，中考海淀前十五。"
    },
    {
      name: "首都师范大学附属育新学校",
      tier: "第二梯队",
      address: "西三旗东路新康园4号",
      location: [116.351473, 40.063653],
      score: 612,
      districtRank: "前5800",
      enrollment2024: 40,
      applicants: 59,
      acceptanceRate: "67.80%",
      features: {
        advantages: "九年一贯制衔接",
        educationPath: ["国内高考"]
      },
      enrollment2025: 40,
      acceptanceRate2025: "67.8%",
      description: "高考一本率 90%+，中考成绩稳定，十二年一贯制管理。"
    },
    {
      name: "中央民族大学附属中学",
      tier: "第二梯队",
      address: "法华寺甲5号",
      location: [116.315734, 39.95101],
      score: 630,
      districtRank: "前2300",
      enrollment2024: 100,
      applicants: 678,
      acceptanceRate: "14.75%",
      features: {
        advantages: "全国招生",
        educationPath: ["国内高考"]
      },
      enrollment2025: 200,
      acceptanceRate2025: "29.5%",
      description: "民族教育特色校，中考高分段海淀前十二，高考清北率超 10%。"
    },
    {
      name: "清华大学附属中学上地学校【借址北京市志清中学，学籍为清华大学附属中学上地学校】",
      tier: "第六梯队",
      address: "中关村北大街圆明园东路",
      location: [116.324736, 40.018663],
      score: 628,
      districtRank: "前3000",
      enrollment2024: 40,
      applicants: 223,
      acceptanceRate: "17.94%",
      features: {
        advantages: "师资共享本部",
        educationPath: ["国内高考"]
      },
      enrollment2025: 40,
      acceptanceRate2025: "17.9%",
      description: "借址志清中学，学籍独立，中考海淀前一百二十五，硬件设施一般。"
    },
    {
      name: "清华大学附属中学上地学校",
      tier: "第六梯队",
      address: "中关村北大街2号",
      location: [116.318549, 40.01768],
      score: 628,
      districtRank: "前3000",
      enrollment2024: 40,
      applicants: 223,
      acceptanceRate: "17.94%",
      features: {
        advantages: "师资共享本部",
        educationPath: ["国内高考"]
      },
      enrollment2025: 40,
      acceptanceRate2025: "17.9%",
      description: "借址志清中学，学籍独立，中考海淀前一百二十五，硬件设施一般。"
    },
    {
      name: "北师大二附中海淀学校",
      tier: "第四梯队",
      address: "清河龙岗路宝盛里观澳园18号",
      location: [116.369642, 40.032828],
      score: 618,
      districtRank: "前4500",
      enrollment2024: 70,
      applicants: 98,
      acceptanceRate: "71.43%",
      features: {
        advantages: "文科优势突出",
        educationPath: ["国内高考"]
      },
      enrollment2025: 70,
      acceptanceRate2025: "71.4%",
      description: "文科教学特色，中考海淀前六十，高考本科率 80%+。"
    },
    {
      name: "北京市育英学校科学城学校",
      tier: "第六梯队",
      address: "苏家坨镇苏三路与琪树路交叉口东南140米",
      location: [116.14774, 40.106052],
      score: 608,
      districtRank: "前6300",
      enrollment2024: 50,
      applicants: 65,
      acceptanceRate: "76.92%",
      features: {
        advantages: "科学城资源支持",
        educationPath: ["国内高考"]
      },
      enrollment2025: 60,
      acceptanceRate2025: "92.3%",
      description: "新校借址办学，学籍独立，教学体系待完善，中考成绩暂未公开。"
    },
    {
      name: "北京十一中关村科学城学校",
      tier: "第六梯队",
      address: "苏家坨镇正林街安河家园九里二号楼北侧",
      location: [116.129526, 40.071387],
      score: 608,
      districtRank: "前6300",
      enrollment2024: 90,
      applicants: 122,
      acceptanceRate: "73.77%",
      features: {
        advantages: "科学城产业联动",
        educationPath: ["国内高考"]
      },
      enrollment2025: 105,
      acceptanceRate2025: "86.1%",
      description: "新校借址办学，学籍独立，教学体系待完善，中考成绩暂未公开。"
    },
    {
      name: "北京市十一学校 - 北校区",
      tier: "第八梯队",
      address: "苏家坨镇环谷园路8号",
      location: [116.113088, 40.065939],
      score: "同本部",
      districtRank: "同本部",
      enrollment2024: 300,
      applicants: 3655,
      acceptanceRate: "8.21%",
      features: {
        advantages: "与本部课程同步",
        educationPath: ["高考", "出国"]
      },
      enrollment2025: 120,
      acceptanceRate2025: "3.3%",
      description: "(注：以下学校主要作为 \"借址方\"，自身非独立办学主体，不参与梯队排序)北京市中关村外国语学校（冷泉校区）：仅作为 101 中学双榆树校区借址地，无独立学籍。"
    },
    {
      name: "首都师范大学附属中学科学城学校",
      tier: "第八梯队",
      address: "永丰路与六里屯南路交叉口西北180米",
      location: [116.250727, 40.056472],
      score: "新校",
      districtRank: "暂无",
      enrollment2024: 40,
      applicants: 60,
      acceptanceRate: "66.67%",
      features: {
        advantages: "科学城配套校",
        educationPath: ["国内高考（规划）"]
      },
      enrollment2025: 40,
      acceptanceRate2025: "66.7%",
      description: "新校借址办学，学籍独立，教学体系待完善，中考成绩暂未公开。"
    },
    {
      name: "北大附中西三旗学校",
      tier: "第五梯队",
      address: "英润路1号",
      location: [116.357043, 40.059679],
      score: 610,
      districtRank: "前6000",
      enrollment2024: 60,
      applicants: 286,
      acceptanceRate: "20.98%",
      features: {
        advantages: "新校区设施先进",
        educationPath: ["国内高考"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "28.0%",
      description: "北大附中分校，借址办学，中考海淀前八十五，依托本部课程框架。"
    },
    {
      name: "北大附中新馨学校",
      tier: "第五梯队",
      address: "建材城西路16号院",
      location: [116.352352, 40.058275],
      score: 610,
      districtRank: "前6000",
      enrollment2024: 80,
      applicants: 145,
      acceptanceRate: "55.17%",
      features: {
        advantages: "小初高一体化",
        educationPath: ["国内高考"]
      },
      enrollment2025: 80,
      acceptanceRate2025: "55.2%",
      description: "北大附中分校，借址办学，中考海淀前九十，侧重创新教育。"
    },
    {
      name: "北京外国语大学附属外国语学校",
      tier: "第六梯队",
      address: "西二旗大街19号",
      location: [116.320336, 40.057998],
      score: 618,
      districtRank: "前4500",
      enrollment2024: 100,
      applicants: 323,
      acceptanceRate: "30.96%",
      features: {
        advantages: "多语种教学",
        educationPath: ["高考", "留学"]
      },
      enrollment2025: 100,
      acceptanceRate2025: "31.0%",
      description: "民办校，外语特色突出，但中考成绩海淀后二十，整体教学质量待提升。"
    },
    {
      name: "北京市建华实验学校",
      tier: "第六梯队",
      address: "唐家岭西环路17号",
      location: [116.276809, 40.063808],
      score: 623,
      districtRank: "前3800",
      enrollment2024: 60,
      applicants: 112,
      acceptanceRate: "53.57%",
      features: {
        advantages: "小班教学",
        educationPath: ["高考", "竞赛"]
      },
      enrollment2025: 60,
      acceptanceRate2025: "53.6%",
      description: "民办校，中考成绩海淀末位，学费高，近年口碑一般。"
    }
  ];

  useEffect(() => {
    setSchools(parsedSchools);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || schools.length === 0) return;

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=ca34e973226fee2ca9d8fb9fc05b0205&plugin=AMap.DistrictSearch,AMap.Geocoder,AMap.PlaceSearch&lang=zh_cn`;
    script.async = true;

    const initializeMap = async () => {
      if (!mapContainerRef.current) {
        console.error('Map container not found');
        return;
      }

      try {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.destroy();
          mapInstanceRef.current = null;
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          z-index: 1000;
        `;
        loadingDiv.innerHTML = `
          <div style="text-align: center;">
            <div style="margin-bottom: 10px;">正在加载地图...</div>
            <div style="color: #666; font-size: 12px;">请稍候，正在初始化地图数据</div>
          </div>
        `;
        mapContainerRef.current.appendChild(loadingDiv);

        mapInstanceRef.current = new window.AMap.Map(mapContainerRef.current, MAP_CONFIG);

        // 添加点击事件监听器
        mapInstanceRef.current.on('click', (e) => {
          const lng = e.lnglat.getLng();
          const lat = e.lnglat.getLat();
          setClickedCoordinates({ lng, lat });
          console.log('点击位置:', lng, lat);
        });

        mapInstanceRef.current.on('complete', async () => {
          console.log('Map loaded successfully');
          loadingDiv.remove();

          const createAllMarkers = async () => {
            // 清除现有的标记
            markersRef.current.forEach(marker => {
              if (marker) {
                marker.setMap(null);
              }
            });
            markersRef.current = [];
            infoWindowsRef.current = [];

            // 创建所有标记
            for (const school of schools) {
              let position = school.location;

              // 如果坐标是[0,0]，使用默认位置
              if (position[0] === 0 && position[1] === 0) {
                position = MAP_CONFIG.center;
                console.log(`使用默认坐标: ${school.name}`);
              }

              const acceptanceRate = school.acceptanceRate2025 || '0%';
              const rateNumber = acceptanceRate.replace('%', '');

              try {
                const marker = new window.AMap.Marker({
                  position: position,
                  title: school.name,
                  map: mapInstanceRef.current,
                  animation: 'AMAP_ANIMATION_DROP',
                  icon: new window.AMap.Icon({
                    size: new window.AMap.Size(50, 50),
                    image: createCustomMarker(school.tier, rateNumber),
                    imageSize: new window.AMap.Size(50, 50)
                  }),
                  offset: new window.AMap.Pixel(-25, -25),
                  zIndex: 100 + markersRef.current.length,
                  label: {
                    content: school.name,
                    direction: 'top',
                    offset: new window.AMap.Pixel(0, -15),
                    style: {
                      color: '#333',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: '#fff',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      border: `1px solid ${TIER_COLORS[school.tier] || '#808080'}`
                    }
                  }
                });

                markersRef.current.push(marker);

                const infoWindow = new window.AMap.InfoWindow({
                  content: generateInfoWindowContent(school),
                  offset: new window.AMap.Pixel(0, -30),
                  closeWhenClickMap: true
                });

                infoWindowsRef.current.push(infoWindow);

                marker.on('click', () => {
                  infoWindowsRef.current.forEach(window => {
                    if (window) {
                      window.close();
                    }
                  });
                  infoWindow.open(mapInstanceRef.current, marker.getPosition());
                });

                console.log(`创建标记: ${school.name} 位置:`, position);
              } catch (error) {
                console.error(`创建标记失败: ${school.name}`, error);
              }
            }

            console.log(`总共创建了 ${markersRef.current.length} 个标记`);
          };

          await createAllMarkers();
        });

        setMapLoaded(true);
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    script.onload = () => {
      console.log('Map script loaded successfully');
      initializeMap();
    };

    script.onerror = (error) => {
      console.error('Error loading map script:', error);
    };

    document.head.appendChild(script);

    return () => {
      console.log('Cleaning up map resources...');
      infoWindowsRef.current.forEach(window => {
        if (window) {
          window.close();
        }
      });
      infoWindowsRef.current = [];

      markersRef.current.forEach(marker => {
        if (marker) {
          marker.setMap(null);
          marker.off('click');
        }
      });
      markersRef.current = [];

      if (mapInstanceRef.current) {
        mapInstanceRef.current.clearMap();
        mapInstanceRef.current.destroy();
        mapInstanceRef.current = null;
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [schools]);

  return (
    <ErrorBoundary>
      <div translate="no" style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        {/* <h1 style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1000, background: 'rgba(255, 255, 255, 0.9)', padding: '10px', borderRadius: '5px' }}>北京中学梯队及位置信息</h1> */}

        {/* 添加坐标显示组件 */}
      {/*   {clickedCoordinates && (
          <div style={{
            position: 'absolute',
            top: '80px',
            left: '20px',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '10px',
            borderRadius: '5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ marginBottom: '5px' }}>点击位置坐标：</div>
            <div>经度：{clickedCoordinates.lng.toFixed(6)}</div>
            <div>纬度：{clickedCoordinates.lat.toFixed(6)}</div>
            <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
              点击地图任意位置可获取坐标
            </div>
          </div>
        )} */}

        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}>
          {!mapLoaded && <div style={{ padding: '20px', textAlign: 'center' }}>正在加载地图...</div>}
        </div>

        <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', padding: '15px', backgroundColor: 'rgba(245, 245, 245, 0.9)', borderRadius: '8px', zIndex: 1000 }}>
          <h3 style={{ marginBottom: '10px' }}>梯队颜色说明：</h3>
         {/*  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {Object.entries(TIER_COLORS).map(([tier, color]) => (
              <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: color, borderRadius: '50%' }}></div>
                <span>{tier}：{color === '#FF0000' ? '赤色' :
                  color === '#FF7F00' ? '橙色' :
                    color === '#FFFF00' ? '黄色' :
                      color === '#00FF00' ? '绿色' :
                        color === '#00FFFF' ? '青色' :
                          color === '#0000FF' ? '蓝色' :
                            color === '#8B00FF' ? '紫色' : '灰色'}</span>
              </div>
            ))}
          </div> */}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
