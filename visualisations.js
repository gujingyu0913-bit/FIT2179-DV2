const DATA = {
  cityProfiles: "data/derived_city_profiles.csv",
  cityGroups: "data/derived_city_group_ordered.csv",
  cityDelta: "data/derived_city_group_delta.csv",
  cityWheel: "data/derived_city_basket_wheel.csv",
  basketDots: "data/derived_basket_dots.csv",
  basketLabels: "data/derived_basket_labels.csv",
  nationalGroup: "data/national_group.csv",
  monthlyAnnual: "data/monthly_vs_annual.csv",
  contributions: "data/derived_contributions_without_total.csv",
  goodsServices: "data/goods_services.csv",
  essentials: "data/derived_essential_shocks.csv",
  fuel: "data/fuel.csv",
  wageClean: "data/derived_wage_gap_clean.csv",
  wageLong: "data/wage_gap_long.csv",
  housingSegments: "data/derived_housing_threshold_segments.csv"
};

const embedOptions = { actions: false, renderer: "svg" };
let cityProfiles = [];
let cityGroups = [];
let nationalGroups = [];
let state = { city: "Melbourne", group: "Transport" };

const MAP_DEFAULT = {
  center: [134, -35],
  scale: 760,
  translate: [280, 360]
};

let mapView = {
  center: [...MAP_DEFAULT.center],
  scale: MAP_DEFAULT.scale,
  translate: [...MAP_DEFAULT.translate]
};

function esc(value){ return JSON.stringify(value); }
function eq(field, value){ return `datum[${JSON.stringify(field)}] === ${esc(value)}`; }
function num(v){ return Number.parseFloat(v); }
function pct(v, digits=1){ return Number.isFinite(+v) ? `${(+v).toFixed(digits)}%` : "n/a"; }
function pp(v, digits=1){ return Number.isFinite(+v) ? `${(+v).toFixed(digits)} pp` : "n/a"; }

const baseConfig = {
  background: null,
  config: {
    font: "Inter, system-ui, sans-serif",
    title: {font: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: 800, color: "#13203a", anchor: "start"},
    axis: {
      labelFont: "Inter, system-ui, sans-serif", titleFont: "Inter, system-ui, sans-serif",
      labelColor: "#40526b", titleColor: "#13203a", gridColor: "#dce9f4", tickColor: "#b7cadb", domainColor: "#a9bece"
    },
    legend: {labelFont: "Inter, system-ui, sans-serif", titleFont: "Inter, system-ui, sans-serif", orient: "bottom", labelColor:"#40526b", titleColor:"#13203a"},
    view: {stroke: null}
  }
};

const heatScale = {domain: [-2, 0, 3, 6, 10, 12], range: ["#2166ac", "#9bd6e7", "#f7fbff", "#f6b26b", "#e34a33", "#8f1d2c"]};
const citySort = ["Hobart", "Adelaide", "Brisbane", "Melbourne", "Perth", "Sydney", "Canberra", "Darwin"];
const groupSort = [
  "All groups CPI", "Food and non-alcoholic beverages", "Alcohol and tobacco", "Clothing and footwear",
  "Housing", "Furnishings, household equipment and services", "Health", "Transport", "Communication",
  "Recreation and culture", "Education", "Insurance and financial services"
];

async function init(){
  [cityProfiles, cityGroups, nationalGroups] = await Promise.all([
    d3.csv(DATA.cityProfiles, d3.autoType),
    d3.csv(DATA.cityGroups, d3.autoType),
    d3.csv(DATA.nationalGroup, d3.autoType)
  ]);
  fillControls();
  updateStoryCards();
  await renderAll();
}

function fillControls(){
  const citySelect = document.getElementById("cityControl");
  const groupSelect = document.getElementById("groupControl");
  citySort.forEach(c => citySelect.add(new Option(c, c)));
  nationalGroups
    .filter(d => d.group !== "All groups CPI")
    .sort((a,b)=>d3.descending(+a.annual_change, +b.annual_change))
    .forEach(d => groupSelect.add(new Option(d.group, d.group)));
  citySelect.value = state.city;
  groupSelect.value = state.group;
  citySelect.addEventListener("change", e => { state.city = e.target.value; updateStoryCards(); renderAll(); });
  groupSelect.addEventListener("change", e => { state.group = e.target.value; updateStoryCards(); renderAll(); });
}

function updateControls(){
  document.getElementById("cityControl").value = state.city;
  document.getElementById("groupControl").value = state.group;
}

function selectedCityProfile(){ return cityProfiles.find(d => d.city === state.city) || cityProfiles[0]; }
function selectedNationalGroup(){ return nationalGroups.find(d => d.group === state.group) || nationalGroups[0]; }

function updateStoryCards(){
  const c = selectedCityProfile();
  const g = selectedNationalGroup();
  const cityRows = cityGroups.filter(d => d.city === state.city && d.group !== "All groups CPI").sort((a,b)=>b.annual_change-a.annual_change);
  const top = cityRows[0] || {};
  const selectedLocal = cityRows.find(d => d.group === state.group || d.group_full === g.group_full) || {};

  document.getElementById("selectedStory").textContent = `${state.city} sits at ${pct(c.annual_cpi)} annual CPI. Its strongest local pressure is ${top.group} at ${pct(top.annual_change)}, while the selected national basket item, ${state.group}, is ${pct(g.annual_change)} nationally${selectedLocal.annual_change ? ` and ${pct(selectedLocal.annual_change)} in ${state.city}` : ""}.`;
  document.getElementById("heroCityMetric").textContent = pct(c.annual_cpi);
  document.getElementById("heroCityLabel").textContent = `${state.city} annual CPI, March 2026`;
  document.getElementById("heroGroupMetric").textContent = pct(g.annual_change);
  document.getElementById("heroGroupLabel").textContent = `${state.group} national annual change`;
  document.getElementById("heroTopMetric").textContent = top.group || "Transport";
  document.getElementById("heroTopLabel").textContent = `hottest local basket in ${state.city}`;
  document.getElementById("chapterCity").textContent = state.city;
  document.getElementById("chapterCityText").textContent = state.city;
  document.getElementById("chapterGroup").textContent = state.group;
}

function onChartClick(result){
  result.view.addEventListener("click", (event, item) => {
    if (!item || !item.datum) return;
    const d = item.datum;
    let changed = false;
    if (d.city && citySort.includes(d.city)) { state.city = d.city; changed = true; }
    if (d.group && d.group !== "All groups CPI") { state.group = d.group; changed = true; }
    if (d.group_full) {
      const match = nationalGroups.find(x => x.group_full === d.group_full || x.group === d.group_full);
      if (match && match.group !== "All groups CPI") { state.group = match.group; changed = true; }
    }
    if (changed){ updateControls(); updateStoryCards(); renderAll(); }
  });
}

async function renderAll(){
  const renders = [
    vegaEmbed("#mapChart", mapSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#cityHeatmap", cityHeatmapSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#cityWheel", cityWheelSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#rankLadder", rankLadderSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#basketDots", basketDotsSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#monthlyAnnual", monthlyAnnualSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#contribStream", contributionStreamSpec(), embedOptions).then(onChartClick),
    vegaEmbed("#goodsPulse", goodsPulseSpec(), embedOptions),
    vegaEmbed("#essentialCalendar", essentialCalendarSpec(), embedOptions),
    vegaEmbed("#fuelSpikes", fuelSpikesSpec(), embedOptions),
    vegaEmbed("#wageGap", wageGapSpec(), embedOptions),
    vegaEmbed("#housingStress", housingStressSpec(), embedOptions)
  ];
  await Promise.all(renders);
}
function renderMapOnly() {
  vegaEmbed("#mapChart", mapSpec(), embedOptions).then(onChartClick);
}

document.getElementById("zoomInBtn")?.addEventListener("click", () => {
  mapView.scale = mapView.scale * 1.18;
  renderMapOnly();
});

document.getElementById("zoomOutBtn")?.addEventListener("click", () => {
  mapView.scale = mapView.scale / 1.18;
  renderMapOnly();
});

document.getElementById("resetZoomBtn")?.addEventListener("click", () => {
  mapView = {
    center: [...MAP_DEFAULT.center],
    scale: MAP_DEFAULT.scale,
    translate: [...MAP_DEFAULT.translate]
  };
  renderMapOnly();
});

function mapSpec(){
  return {
    ...baseConfig,
    width: "container", height: 560,
    projection: {
  type: "mercator",
  center: mapView.center,
  scale: mapView.scale,
  translate: mapView.translate
},
    layer: [
      { data: {graticule: {step: [10, 10]}}, mark: {type: "geoshape", stroke: "#d6e7f1", strokeWidth: 0.7, opacity: 0.7} },
      { data: {url: "https://vega.github.io/vega-datasets/data/world-110m.json", format: {type: "topojson", feature: "countries"}},
        mark: {type: "geoshape", fill: "#d8e3ea", stroke: "#ffffff", strokeWidth: 0.7} },
      { data: {url: DATA.cityProfiles},
        mark: {type: "circle", opacity: 0.18, stroke: "#ffffff", strokeWidth: 0},
        encoding: { longitude: {field: "longitude", type: "quantitative"}, latitude: {field: "latitude", type: "quantitative"}, size: {field: "annual_cpi", type: "quantitative", scale: {domain: [4,5.2], range: [1500, 4700]}, legend: null}, color: {field: "annual_cpi", type: "quantitative", scale: heatScale, legend: null} } },
      { data: {url: DATA.cityProfiles},
        mark: {type: "circle", strokeWidth: 2.4, cursor: "pointer"},
        encoding: {
          longitude: {field: "longitude", type: "quantitative"}, latitude: {field: "latitude", type: "quantitative"},
          size: {field: "annual_cpi", type: "quantitative", scale: {domain: [4,5.2], range: [130, 720]}, title: "Annual CPI"},
          color: {field: "annual_cpi", type: "quantitative", scale: heatScale, title: "Annual CPI (%)"},
          stroke: {condition: {test: eq("city", state.city), value: "#091a37"}, value: "#ffffff"},
          opacity: {condition: {test: eq("city", state.city), value: 1}, value: 0.76},
          tooltip: [
            {field:"city", type:"nominal", title:"City"}, {field:"annual_cpi", type:"quantitative", title:"Annual CPI (%)", format:".1f"},
            {field:"rank", type:"ordinal", title:"Rank"}, {field:"top_group", type:"nominal", title:"Top local pressure"}, {field:"top_group_change", type:"quantitative", title:"Top group (%)", format:".1f"}
          ]
        } },
      { data: {url: DATA.cityProfiles},
        mark: {type: "text", dy: -14, fontSize: 11, fontWeight: 800, color: "#13203a"},
        encoding: { longitude: {field: "longitude", type: "quantitative"}, latitude: {field: "latitude", type: "quantitative"}, text: {field: "city"}, opacity: {condition: {test: eq("city", state.city), value: 1}, value: 0.52} } }
    ]
  };
}

function cityHeatmapSpec(){
  return {
    ...baseConfig,
    width: "container", height: 415,
    data: {url: DATA.cityGroups},
    mark: {type: "rect", strokeWidth: 2, cornerRadius: 3, cursor: "pointer"},
    encoding: {
      x: {field: "city", type: "nominal", sort: citySort, axis: {title: null, labelAngle: -35, labelFontWeight: 800}},
      y: {field: "group", type: "nominal", sort: groupSort, axis: {title: null, labelLimit: 230}},
      color: {field: "annual_change", type: "quantitative", scale: heatScale, title: "Annual change (%)"},
      stroke: {condition: [
        {test: `${eq("city", state.city)} && (${eq("group", state.group)} || ${eq("group_full", state.group)})`, value: "#071832"},
        {test: `${eq("city", state.city)} || ${eq("group", state.group)} || ${eq("group_full", state.group)}`, value: "#f26a3d"}
      ], value: "#ffffff"},
      opacity: {condition: {test: `${eq("city", state.city)} || ${eq("group", state.group)} || ${eq("group_full", state.group)}`, value: 1}, value: 0.82},
      tooltip: [{field:"city"},{field:"group", title:"Basket group"},{field:"annual_change", title:"Annual change (%)", format:".1f"}]
    }
  };
}

function cityWheelSpec(){
  return {
    ...baseConfig,
    width: "container", height: 330,
    data: {url: DATA.cityWheel},
    transform: [{filter: eq("city", state.city)}],
    layer: [
      { mark: {type: "arc", innerRadius: 55, stroke: "#ffffff", strokeWidth: 1.5, cursor: "pointer"},
        encoding: {
          theta: {field: "unit", type: "quantitative", stack: true},
          radius: {field: "annual_change", type: "quantitative", scale: {domain: [0, 12], range: [72, 160]}, legend: null},
          color: {field: "annual_change", type: "quantitative", scale: heatScale, legend: {title: "Annual change (%)"}},
          order: {field: "group_order", type: "ordinal"},
          opacity: {condition: {test: `${eq("group", state.group)} || ${eq("group_full", state.group)}`, value: 1}, value: 0.72},
          tooltip: [{field:"city"},{field:"group", title:"Basket group"},{field:"annual_change", title:"Annual change (%)", format:".1f"}]
        } },
      { data: {values:[{label:"local basket wheel"}]}, mark: {type:"text", align:"center", baseline:"middle", fontWeight:900, fontSize:12, color:"#40526b"}, encoding:{text:{field:"label"}} }
    ]
  };
}

function rankLadderSpec(){
  return {
    ...baseConfig,
    width: "container", height: 315,
    data: {url: DATA.cityProfiles},
    layer: [
      {mark: {type:"rule", color:"#dce9f4"}, encoding: {x: {datum: 4.0}, x2: {datum: 5.3}, y: {field:"city", type:"nominal", sort: citySort}}},
      {mark: {type:"circle", filled:true, strokeWidth:2.4, cursor:"pointer"}, encoding: {
        x: {field:"annual_cpi", type:"quantitative", scale:{domain:[4.0,5.3]}, axis:{title:"Annual CPI (%)"}},
        y: {field:"city", type:"nominal", sort: citySort, axis:{title:null, labelFontWeight:800}},
        size: {field:"annual_cpi", type:"quantitative", scale:{range:[160,760]}, legend:null},
        color: {field:"annual_cpi", type:"quantitative", scale:heatScale, legend:null},
        stroke: {condition: {test: eq("city", state.city), value:"#071832"}, value:"#ffffff"},
        opacity: {condition: {test: eq("city", state.city), value:1}, value:.72},
        tooltip: [{field:"rank"},{field:"city"},{field:"annual_cpi", title:"Annual CPI (%)", format:".1f"}]
      }},
      {mark: {type:"text", align:"left", dx:12, fontSize:11, fontWeight:800, color:"#27364f"}, encoding: {x:{field:"annual_cpi", type:"quantitative"}, y:{field:"city", type:"nominal", sort:citySort}, text:{field:"annual_cpi", type:"quantitative", format:".1f"}}}
    ]
  };
}

function basketDotsSpec(){
  return {
    ...baseConfig,
    width: "container", height: 500,
    layer: [
      {data: {url: DATA.basketDots}, mark: {type:"square", size:56, cornerRadius:2, cursor:"pointer"}, encoding: {
        x: {field:"x", type:"quantitative", scale:{domain:[-2,18.8]}, axis:null},
        y: {field:"global_y", type:"quantitative", scale:{domain:[-1,73], reverse:true}, axis:null},
        color: {field:"annual_change", type:"quantitative", scale:heatScale, legend:{title:"Annual change (%)"}},
        opacity: {condition: {test: `${eq("group", state.group)} || ${eq("group_full", state.group)}`, value:1}, value:.55},
        tooltip: [{field:"group", title:"Basket group"},{field:"annual_change", title:"Annual change (%)", format:".1f"},{field:"dot_value_pp", title:"Each square (pp)", format:".1f"}]
      }},
      {data: {url: DATA.basketLabels}, mark: {type:"text", align:"right", baseline:"middle", fontSize:11, fontWeight:800, color:"#13203a"}, encoding: {
        x: {field:"label_x", type:"quantitative", scale:{domain:[-2,18.8]}, axis:null},
        y: {field:"label_y", type:"quantitative", scale:{domain:[-1,73], reverse:true}, axis:null},
        text: {field:"group"},
        opacity: {condition: {test: `${eq("group", state.group)} || ${eq("group_full", state.group)}`, value:1}, value:.72}
      }}
    ]
  };
}

function monthlyAnnualSpec(){
  return {
    ...baseConfig,
    width: "container", height: 340,
    data: {url: DATA.monthlyAnnual},
    layer: [
      {mark:{type:"rule", color:"#c8d8e5", strokeDash:[4,4]}, encoding:{x:{datum:0}}},
      {mark:{type:"rule", color:"#c8d8e5", strokeDash:[4,4]}, encoding:{y:{datum:0}}},
      {mark:{type:"point", filled:true, strokeWidth:2, size:220, cursor:"pointer"}, encoding:{
        x:{field:"monthly_change", type:"quantitative", axis:{title:"Latest monthly movement (%)"}},
        y:{field:"annual_change", type:"quantitative", axis:{title:"Annual change (%)"}},
        color:{field:"category_type", type:"nominal", legend:{title:"Basket type"}},
        stroke:{condition:{test:`${eq("group", state.group)} || ${eq("group_full", state.group)}`, value:"#071832"}, value:"#ffffff"},
        opacity:{condition:{test:`${eq("group", state.group)} || ${eq("group_full", state.group)}`, value:1}, value:.66},
        tooltip:[{field:"group", title:"Group"},{field:"annual_change", format:".1f", title:"Annual (%)"},{field:"monthly_change", format:".1f", title:"Monthly (%)"},{field:"category_type", title:"Type"}]
      }},
      {transform:[{filter:`${eq("group", state.group)} || ${eq("group_full", state.group)}`}], mark:{type:"text", dx:10, dy:-10, align:"left", fontWeight:900, color:"#13203a"}, encoding:{x:{field:"monthly_change", type:"quantitative"}, y:{field:"annual_change", type:"quantitative"}, text:{field:"group"}}}
    ]
  };
}

function contributionStreamSpec(){
  return {
    ...baseConfig,
    width: "container", height: 330,
    data: {url: DATA.contributions}
    ,
    mark: {type:"area", interpolate:"monotone", cursor:"pointer"},
    encoding: {
      x: {field:"date", type:"temporal", axis:{title:null, format:"%b %Y", labelAngle:0}},
      y: {field:"contribution_pct_points", type:"quantitative", stack:"center", axis:{title:"Contribution to annual CPI (pp)", labels:false, ticks:false}},
      color: {field:"group", type:"nominal", legend:null},
      opacity: {condition: {test:`${eq("group", state.group)} || ${eq("group_full", state.group)}`, value:.95}, value:.22},
      tooltip: [{field:"date", type:"temporal", title:"Month", format:"%b %Y"},{field:"group", title:"Group"},{field:"contribution_pct_points", title:"Contribution (pp)", format:".2f"}]
    }
  };
}

function goodsPulseSpec(){
  return {
    ...baseConfig,
    width: "container", height: 230,
    data: {url: DATA.goodsServices},
    mark: {type:"rect", cornerRadius:4},
    encoding: {
      x: {field:"date", type:"temporal", timeUnit:"yearmonth", axis:{title:null, format:"%b %y", labelAngle:-45}},
      y: {field:"series", type:"nominal", axis:{title:null, labelFontWeight:900}},
      color: {field:"monthly_change", type:"quantitative", scale:{domain:[-1.5,0,1.5], range:["#2166ac","#f7fbff","#c7292d"]}, title:"Monthly change (%)"},
      tooltip: [{field:"date", type:"temporal", format:"%b %Y"},{field:"series"},{field:"index", format:".1f"},{field:"monthly_change", title:"Monthly (%)", format:".2f"},{field:"annual_change", title:"Annual (%)", format:".1f"}]
    }
  };
}

function essentialCalendarSpec(){
  return {
    ...baseConfig,
    width: "container",
    height: 620,
    spacing: 30,
    autosize: {type: "fit", contains: "padding"},
    data: {url: DATA.essentials},
    facet: {row: {field:"category", type:"nominal", title:null, header:{labelFontSize:13, labelFontWeight:900, labelColor:"#13203a"}}},
    spec: {
      width: 900,
      height: 170,
      mark: {type:"rect", cornerRadius:3},
      encoding: {
x: {
  field: "month",
  type: "ordinal",
  sort: [1,2,3,4,5,6,7,8,9,10,11,12],
  axis: {
    title: null,
    labelAngle: 0,
    labelFontSize: 10,
    labelExpr: "['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][datum.value-1]"
  }
},
        y: {
          field: "year",
          type: "ordinal",
          sort: "descending",
          axis: {
            title: null,
            labelFontSize: 10,
            labelPadding: 5
          }
        },
        color: {field:"monthly_change", type:"quantitative", scale:{domain:[-10,0,10], range:["#2166ac","#f7fbff","#c7292d"]}, title:"Monthly change (%)"},
        opacity: {condition: {test:"isValid(datum.monthly_change)", value:1}, value:.1},
        tooltip: [{field:"category"},{field:"date", type:"temporal", format:"%b %Y"},{field:"monthly_change", title:"Monthly (%)", format:".2f"},{field:"annual_change", title:"Annual (%)", format:".1f"}]
      }
    },
    resolve: {scale: {y: "independent"}}
  };
}

function fuelSpikesSpec(){
  return {
    ...baseConfig,
    width: "container", height: 280,
    data: {url: DATA.fuel},
    transform: [
      {filter: "isValid(datum.monthly_change)"},
      {calculate: "datum.monthly_change >= 0 ? 'rise' : 'fall'", as:"direction"}
    ],
    layer: [
      {mark:{type:"rule", color:"#a9bece"}, encoding:{y:{datum:0}}},
      {mark:{type:"rule", strokeWidth:2}, encoding:{
        x:{field:"date", type:"temporal", axis:{title:null, format:"%Y"}}, y:{datum:0}, y2:{field:"monthly_change"},
        color:{field:"direction", type:"nominal", scale:{domain:["rise","fall"], range:["#c7292d", "#2166ac"]}, legend:{title:null}},
        tooltip:[{field:"date", type:"temporal", format:"%b %Y"},{field:"monthly_change", title:"Monthly movement (%)", format:".2f"},{field:"annual_change", title:"Annual (%)", format:".1f"}]
      }},
      {transform:[{filter:"abs(datum.monthly_change) >= 8"}], mark:{type:"point", filled:true, size:100, stroke:"#ffffff"}, encoding:{x:{field:"date", type:"temporal"}, y:{field:"monthly_change", type:"quantitative"}, color:{field:"direction", type:"nominal", scale:{domain:["rise","fall"], range:["#c7292d", "#2166ac"]}, legend:null}}}
    ],
    encoding: { y: {field:"monthly_change", type:"quantitative", axis:{title:"Monthly fuel movement (%)"}} }
  };
}

function wageGapSpec(){
  return {
    ...baseConfig,
    width: "container",
    height: 300,

    data: {url: DATA.wageClean},

    transform: [
      {
        calculate: "timeFormat(toDate(datum.date), '%b %Y')",
        as: "date_label"
      },
      {
        calculate: "datum.wpi_annual_change * 1",
        as: "wpi_value"
      },
      {
        calculate: "datum.cpi_annual_change * 1",
        as: "cpi_value"
      },
      {
        filter: "isValid(datum.wpi_value) && isValid(datum.cpi_value) && datum.wpi_value > 0 && datum.cpi_value > 0"
      }
    ],

    layer: [
      {
        mark: {
          type: "rule",
          strokeWidth: 5,
          opacity: 0.45
        },
        encoding: {
          y: {
            field: "date_label",
            type: "ordinal",
            sort: {
              field: "date",
              order: "ascending"
            },
            axis: {
              title: null
            }
          },
          x: {
            field: "wpi_value",
            type: "quantitative",
            scale: {domain: [0, 5.2]},
            axis: {
              title: "Annual change (%)"
            }
          },
          x2: {
            field: "cpi_value"
          },
          color: {
            condition: {
              test: "datum.cpi_value > datum.wpi_value",
              value: "#c7292d"
            },
            value: "#1b9e77"
          },
          tooltip: [
            {field: "date_label", title: "Date"},
            {field: "wpi_value", title: "Wage Price Index (%)", format: ".1f"},
            {field: "cpi_value", title: "Consumer Price Index (%)", format: ".1f"}
          ]
        }
      },

      {
        mark: {
          type: "circle",
          filled: true,
          size: 150,
          stroke: "#ffffff",
          strokeWidth: 1.5
        },
        encoding: {
          y: {
            field: "date_label",
            type: "ordinal",
            sort: {
              field: "date",
              order: "ascending"
            },
            axis: {
              title: null
            }
          },
          x: {
            field: "wpi_value",
            type: "quantitative",
            scale: {domain: [0, 5.2]}
          },
          color: {
            value: "#1b9e77"
          },
          tooltip: [
            {field: "date_label", title: "Date"},
            {field: "wpi_value", title: "Wage Price Index (%)", format: ".1f"}
          ]
        }
      },

      {
        mark: {
          type: "circle",
          filled: true,
          size: 150,
          stroke: "#ffffff",
          strokeWidth: 1.5
        },
        encoding: {
          y: {
            field: "date_label",
            type: "ordinal",
            sort: {
              field: "date",
              order: "ascending"
            },
            axis: {
              title: null
            }
          },
          x: {
            field: "cpi_value",
            type: "quantitative",
            scale: {domain: [0, 5.2]}
          },
          color: {
            value: "#c7292d"
          },
          tooltip: [
            {field: "date_label", title: "Date"},
            {field: "cpi_value", title: "Consumer Price Index (%)", format: ".1f"}
          ]
        }
      }
    ]
  };
}

function housingStressSpec() {
  return {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "background": "transparent",
    "width": "container",
    "height": 260,
    "padding": {
      "left": 28,
      "right": 28,
      "top": 35,
      "bottom": 45
    },

    "layer": [
      {
        "data": {
          "values": [
            { "start": 0, "end": 75 }
          ]
        },
        "mark": {
          "type": "bar",
          "height": 62,
          "cornerRadius": 16,
          "color": "#edf3f8"
        },
        "encoding": {
          "x": {
            "field": "start",
            "type": "quantitative",
            "scale": { "domain": [0, 75] },
            "axis": null
          },
          "x2": { "field": "end" },
          "y": { "value": 135 }
        }
      },

      {
        "data": {
          "values": [
            {
              "zone": "Lower burden",
              "start": 0,
              "end": 25,
              "meaning": "Rent takes a smaller share of income"
            },
            {
              "zone": "Near threshold",
              "start": 25,
              "end": 30,
              "meaning": "Close to the 30% rental stress line"
            },
            {
              "zone": "Housing stress",
              "start": 30,
              "end": 45,
              "meaning": "Rent reaches or passes 30% of income"
            },
            {
              "zone": "High pressure",
              "start": 45,
              "end": 60,
              "meaning": "A large share of income is absorbed by rent"
            },
            {
              "zone": "Severe pressure",
              "start": 60,
              "end": 75,
              "meaning": "Very high rental burden"
            }
          ]
        },
        "mark": {
          "type": "bar",
          "height": 54,
          "cornerRadius": 12,
          "stroke": "white",
          "strokeWidth": 2
        },
        "encoding": {
          "x": {
            "field": "start",
            "type": "quantitative",
            "scale": { "domain": [0, 75] },
            "axis": {
              "title": "Share of income spent on rent (%)",
              "values": [0, 15, 30, 45, 60, 75],
              "labelFontSize": 12,
              "titleFontSize": 13,
              "titleFontWeight": "bold",
              "labelColor": "#334a68",
              "titleColor": "#12213d",
              "grid": false
            }
          },
          "x2": { "field": "end" },
          "y": { "value": 135 },
          "color": {
            "field": "zone",
            "type": "nominal",
            "scale": {
              "domain": [
                "Lower burden",
                "Near threshold",
                "Housing stress",
                "High pressure",
                "Severe pressure"
              ],
              "range": [
                "#8ecae6",
                "#b7e4c7",
                "#ffb45c",
                "#f9734d",
                "#ef476f"
              ]
            },
            "legend": null
          },
          "tooltip": [
            { "field": "zone", "title": "Rental burden zone" },
            { "field": "start", "title": "From (%)" },
            { "field": "end", "title": "To (%)" },
            { "field": "meaning", "title": "Meaning" }
          ]
        }
      },

      {
        "data": {
          "values": [
            { "x": 12.5, "label": "Lower burden" },
            { "x": 37.5, "label": "Stress zone" },
            { "x": 61.5, "label": "Severe pressure" }
          ]
        },
        "mark": {
          "type": "text",
          "fontSize": 13,
          "fontWeight": "bold",
          "color": "#12213d",
          "dy": -12
        },
        "encoding": {
          "x": {
            "field": "x",
            "type": "quantitative",
            "scale": { "domain": [0, 75] },
            "axis": null
          },
          "y": { "value": 100 },
          "text": { "field": "label" }
        }
      },

      {
        "data": {
          "values": [
            { "x": 30 }
          ]
        },
        "mark": {
          "type": "rule",
          "strokeDash": [5, 4],
          "strokeWidth": 3,
          "color": "#12213d"
        },
        "encoding": {
          "x": {
            "field": "x",
            "type": "quantitative",
            "scale": { "domain": [0, 75] },
            "axis": null
          },
          "y": { "value": 62 },
          "y2": { "value": 170 }
        }
      },

      {
        "data": {
          "values": [
            {
              "x": 30,
              "label": "30% stress line"
            }
          ]
        },
        "mark": {
          "type": "text",
          "align": "center",
          "baseline": "bottom",
          "fontSize": 13,
          "fontWeight": "bold",
          "color": "#12213d",
          "dy": -8
        },
        "encoding": {
          "x": {
            "field": "x",
            "type": "quantitative",
            "scale": { "domain": [0, 75] },
            "axis": null
          },
          "y": { "value": 60 },
          "text": { "field": "label" }
        }
      },

      {
        "data": {
          "values": [
            {
              "x": 52,
              "label": "After this point, rent is no longer just a price increase — it becomes a household stress issue."
            }
          ]
        },
        "mark": {
          "type": "text",
          "align": "center",
          "baseline": "middle",
          "fontSize": 12,
          "fontWeight": "600",
          "color": "#40516b",
          "lineBreak": " — ",
          "lineHeight": 16
        },
        "encoding": {
          "x": {
            "field": "x",
            "type": "quantitative",
            "scale": { "domain": [0, 75] },
            "axis": null
          },
          "y": { "value": 212 },
          "text": { "field": "label" }
        }
      }
    ],

    "config": {
      "view": {
        "stroke": null
      },
      "axis": {
        "domainColor": "#9fb3ca",
        "tickColor": "#9fb3ca",
        "labelFont": "Inter",
        "titleFont": "Inter"
      }
    }
  };
}

init();
