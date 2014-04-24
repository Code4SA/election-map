var Code4SA = {};
//Namespace

Code4SA.Framework = (function(window,document,undefined) {
	var settings = {
		bindToElementId: "code4sa",
		project: "test",
		apiKey: ""
	};

	var el = null;

	//Private Methods
	var bindEl = function() {
		el = document.getElementById(settings.bindToElementId);
		Code4SA.template.render(el);
	};

	return {
	//Public Methods
		deploy: function(project) {
			bindEl();
			settings.project = project;
			el.className += "code4sa_deploy";
			// console.log(el, settings);
			Code4SA.app.init();
		}
	};

})(this, this.document);

var year = "2009";
var apiurl = "http://localhost:5000/provincial/";
var mapurl = "http://localhost:8080/political/";
var nationalurl = "http://localhost:5000/national/";

var apiurl = "http://iec-v2.code4sa.org/provincial/";
var mapurl = "http://maps.code4sa.org/political/";
var nationalurl = "http://iec-v2.code4sa.org/national/";

var width = 500;
var height = 450;

var curCode = "";
var curBallot = "";

var curElem;
var history = [];

var num_format = d3.format(",");
var perc_format = d3.format(".2%");
var perc_format_short = d3.format(".0%");

var projection = d3.geo.conicEqualArea()
    .center([0, -28.5])
    .rotate([-24.5, 0])
    .parallels([-25.5, -31.5])
    .scale(1800)
    .translate([width/2, height/2]);

 var path = d3.geo.path().projection(projection);

var svg = d3.select("div#c4sa_map_container").select("svg#c4sa_map_svg");
svg.attr("viewBox", "0 0 " + width + " " + (height + 100)).attr("id", "c4sa_svg");

var mapg = svg.select("g#c4sa_map")
	.on("mousemove", move_overlay)
	.on("mouseout", hide_overlay);
var selph = mapg.select("g#c4sa_selph");
var hoverph = mapg.select("g#c4sa_hoverph");
var borderg = mapg.select("g#c4sa_borders");


var level = 0;
var levels = ["province", "municipality", "ward"];
var levels_zoom = [1, 4, 15];
var wardscache = {};

var linear_scale = d3.scale.linear().domain([0.2, 1]);

// var colors = { "AFRICAN NATIONAL CONGRESS": 30, "DEMOCRATIC ALLIANCE": 190, "INKATHA FREEDOM PARTY": 270, "INDEPENDENT DEMOCRATS": 60, "CONGRESS OF THE PEOPLE": 90, "UNITED DEMOCRATIC MOVEMENT": 170 };

var colors = { "AFRICAN NATIONAL CONGRESS": "#008000", "DEMOCRATIC ALLIANCE": "#04599c", "INKATHA FREEDOM PARTY": "#911c1b", "INDEPENDENT DEMOCRATS": "#f87906", "CONGRESS OF THE PEOPLE": "#ffca08", "UNITED DEMOCRATIC MOVEMENT": "#770433", "VRYHEIDSFRONT PLUS": "#ff00a4", "AFRICAN CHRISTIAN DEMOCRATIC PARTY": "#adfc00", "UNITED CHRISTIAN DEMOCRATIC PARTY": "#AE00FF", "PAN AFRICANIST CONGRESS OF AZANIA": "#895E46", "MINORITY FRONT": "", "AZANIAN PEOPLE'S ORGANISATION": "#728915", "AFRICAN PEOPLE'S CONVENTION": "#895E46", "MOVEMENT DEMOCRATIC PARTY": "#4A5C72", "AL JAMA-AH": "#666", "ECONOMIC FREEDOM FIGHTERS": "#ed1b24" };

function update_map(sender, mapdata, data, demarcation) {
	//Let's prep the area
	var demarcg = mapg.select("g#c4sa_" + demarcation);
	demarcg.selectAll("g").remove();
	var area = demarcg.insert("g").attr("class", "c4sa_area");
	var border = demarcg.insert("g").attr("class", "c4sa_border");
	//Add some data
	if (mapdata) {
		var topo = topojson.feature(mapdata, mapdata.objects.demarcation).features;
		for(var x = 0; x < topo.length; x++) {
			for(var y = 0; y < data.length; y++) {
				if (data[y][demarcation + "_id"] == topo[x].id) {
					topo[x].properties.results = data[y].results;
					topo[x].properties.winner = calc_winners(data[y].results.vote_count);
					topo[x].properties.winner.perc = topo[x].properties.winner.vote_count / data[y].results.meta.total_votes;
				}
			}
			topo[x].properties.level = levels.indexOf(demarcation);
		}


	//Plot our areas
	var areas = area.selectAll("." + demarcation).data(topo);
	areas
		.enter().append("path")
		.attr("class", function(d) { 
			if (d.properties.winner) {
				var winner_id = safe_id(d.properties.winner.party);
			} else {
				var winner_id = "none";
			}
			return demarcation + " " + d.id + " " + "winner_" + winner_id; 
		})
		.style("fill", function(d) { 
			if (d.properties.winner) {
				return d3.rgb(colors[d.properties.winner.party]).darker(linear_scale(d.properties.winner.perc)); 
				// return d3.rgb(colors[d.properties.winner.party]).brighter(linear_scale(d.properties.winner.perc)); 
			} else {
				return "#444";
			}
		})
		.attr("id", function(d) { return "c4sa_" + d.id })
		.attr("d", path)
		.on("click", zoomin)
		.on("mousemove", hovered)
		.on("mouseout", unhovered);
		//Chuck on a border
		var stroke = border.append("path")
			.datum(topojson.mesh(mapdata, mapdata.objects.demarcation, function (a, b){ return a !== b; }))
			.attr("class", "border " + demarcation + "-border")
			.attr("d", path)
			.style("stroke-width", "0.1px");
		hide_parents(sender);
	}
	

	return true;
}


var events_queued = [];

function show_loader() {
	d3.select("#c4sa_loading_container")
		.style("display", "block")
		.style("opacity", 1);
	events_queued = [];
	d3.select("#progtext").html("Loading...");	
}

function hide_loader() {
	d3.select("#c4sa_loading_container")
		.style("opacity", 1)
		.style("opacity", "block")
		.transition()
		.duration(400)
		.style("opacity", 0)
		.each("end", function() {
			d3.select("#c4sa_loading_container").style("display", "none");
		});
}

var prev_angle = 0;
function updateprog(event_name, curr, total) {
	// var progarc = d3.svg.arc().outerRadius(95).innerRadius(50).startAngle(0);
	var tot = 0;
	var tot_loaded = 0;
	if (events_queued.indexOf(event_name) == -1) {
		if (curr == total) {
			events_queued.push(event_name);
		}
	}
	// d3.select("#progbar")
	// 	.attr("d", progarc.endAngle(0))
	// 	.transition()
	// 	.duration(400)
	// 	.attr("d", progarc.endAngle(events_queued.length * Math.PI));
	d3.select("#progtext").html("Loading...");
}

function init() {
	init_seats();
	d3.selectAll(".data-year").html(year);
	show_loader();
	var provinceurl = apiurl + year + "/province/";
	var province_job = d3.json(mapurl + year + "/province?quantization=5000")
		.on("progress", function(d) {
			updateprog("Map", d3.event.loaded, d3.event.total);
		});
	var province_data_job = d3.json(provinceurl)
		.on("progress", function(d) {
			updateprog("Results", d3.event.loaded, d3.event.total);
		});
	queue()
		.defer(province_job.get)
		.defer(province_data_job.get)
		.await(function (error, provinces, province_data) {
			var demarcg = mapg.select("g#c4sa_province");
			demarcg.selectAll("g").remove();
			var area = demarcg.insert("g").attr("class", "c4sa_area");
			var border = demarcg.insert("g").attr("class", "c4sa_border");
			province_data = province_data.results;
			update_map(false, provinces, province_data, "province");
			hide_loader();
		});
}

d3.select("#year_2009").on("click", function() {
	year = "2009";
	init();
});

d3.select("#year_2014").on("click", function() {
	year = "2014";
	init();
});

function progressive_load(d) {
	hide_overlay();
	var areag = mapg.select("g#c4sa_areas");
	show_loader();
	if (level == 1) {
		//Load Minicipalities
		var municipality_job = d3.json(mapurl + year + "/municipality?quantization=3000&filter[province]=" + d.id)
			.on("progress", function(d) {
				updateprog("Results", d3.event.loaded, d3.event.total);
			});
		var municipality_data_job = d3.json(apiurl + year + "/municipality/?all_results=true&province=" + d.id)
			.on("progress", function(d) {
				updateprog("Results", d3.event.loaded, d3.event.total);
			});
		queue()
			.defer(municipality_job.get)
			.defer(municipality_data_job.get)
			.await(function(error, municipality, municipality_data) {
				municipality_data = municipality_data.results;
				update_map(d, municipality, municipality_data, "municipality");
				hide_loader();
			}
		);
		
	}
	if (level == 2) {
		//Load Wards
		var ward_job = d3.json(mapurl + year + "/ward?quantization=3000&filter[municipality]=" + d.id)
			.on("progress", function(d) {
				updateprog("Results", d3.event.loaded, d3.event.total);
			});
		var ward_data_job = d3.json(apiurl + year + "/ward/?all_results=true&municipality=" + d.id)
			.on("progress", function(d) {
				updateprog("Results", d3.event.loaded, d3.event.total);
			});
		//Fire the queue job
		queue()
			.defer(ward_job.get)
			.defer(ward_data_job.get)
			.await(function (error, ward, ward_data) {
				areag.selectAll("." + d.id).style("display", "none");
				areag.selectAll("." + d.properties.PROVINCE).style("display", "none");
				if (typeof ward_data != "undefined") {
					ward_data = ward_data.results;
				} else {
					ward_data = false;
				}
				update_map(d, ward, ward_data, "ward");
				hide_loader();
			}
		);
	}
}

function hide_parents(d) {
	var areag = mapg.select("g#c4sa_areas");
	switch(level) {
		case 0:
			return;
		case 1: //Municipal level - hide province
			d3.selectAll(".province")
				.style("display", "inherit");
			d3.selectAll(".municipality")
				.style("display", "inherit");
			d3.select("#c4sa_" + d.properties.province).style("display", "none");
			d3.select("#c4sa_" + d.properties.municipality).style("display", "none");
			return;
		case 2: //Ward level - hide province and municipality
			d3.select("#c4sa_" + d.properties.municipality).style("display", "none");
			d3.select("#c4sa_" + d.properties.province).style("display", "none");
			return;
	}

}

function zoomin(d) {
	curElem = d;
	level = d.properties.level + 1;
	if (level < 3) {
		progressive_load(d);
	}
	
	if (level > 0) {
		d3.select("#c4sa_zoomout").style("display", "inline");
	}
	if (level == 1) {
		d3.selectAll(".province")
			.style("display", "inherit");
	}
	if (level == 2) {
		d3.selectAll(".municipality")
			.style("display", "inherit");
	}
	var x, y, dx, dy, k, w, h;
	var centroid = path.centroid(d);
	x = centroid[0];
	y = centroid[1];
	var bounds = path.bounds(d);
	dx = bounds[1][0] - bounds[0][0];
	dy = bounds[1][1] - bounds[0][1];
	k = .8 / Math.max(dx / width, dy / height);
	mapg.transition()
		.duration(750)
		.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
		.each("end", function() {
			// hide_parents(d);
		});
	mapg.attr("class", "level-" + level);
}

d3.select("#c4sa_zoomout").on("click", zoomout);

function zoomout() {
	if (level == 1) {
		mapg.transition()
		.duration(750)
		.attr("transform", "translate(0,0)scale(1)");
		level = 0;
		mapg.attr("class", "level-" + level);
		d3.selectAll(".municipality")
			.style("display", "none");
		d3.selectAll(".ward")
			.style("display", "none");
		d3.selectAll(".province")
			.style("display", "inherit");
		d3.select("#c4sa_zoomout")
			.style("display", "none");
	} else if (level == 2) {
		el = d3.select("#c4sa_" + curElem.properties.province);
		zoomin(el.data()[0]);
	} else if (level == 3) {
		el = d3.select("#c4sa_" + curElem.properties.municipality);
		zoomin(el.data()[0]);
	}
}

function calc_winners(vote_count) {
	var winners = [];
	var winner = {};
	var top = 0;
	var tot = 0;
	for(var party in vote_count) {
		if (vote_count[party] > top) {
			top = vote_count[party];
			winner = { party: party, vote_count: vote_count[party] };
		}
	}
	return winner;
}

function sort_votes(vote_count) {
	var tmp = [];
	for (party in vote_count) {
		tmp.push([party, vote_count[party]]);
	}
	tmp.sort(function(a, b) { return b[1] - a[1] });
	return tmp.slice(0, 3);
}

var hovering = false;

function move_overlay() {
	var coordinates = [0, 0];
	coordinates = d3.mouse(svg.node());
	var x = d3.event.pageX - 200;
	var y = d3.event.pageY + 20;
	var overlay = d3.select("div#c4sa_overlay");
	overlay
		.style("display", "block")
		.style("top", y + "px")
		.style("left", x + "px");
}

function hide_overlay() {
	var overlay = d3.select("div#c4sa_overlay");
	overlay
		.style("display", "none");
}

function hovered(d) {
	if (!hovering) {
		hovering = true;
		
		var title = "";
		if (d.properties.level == 0) {
			title = d.properties.province_name;
		} else if (d.properties.level == 1) {
			title = d.properties.municipality_name + ", " + d.properties.province;
		} else {
			title = "Ward " + d.properties.ward_number + ", " + d.properties.municipality_name;
		}
		if (d.properties.results) {
			var results = d.properties.results;
		} else {
			results = {
				meta: {
					spoilt_votes: 0,
					num_registered: 0, 
					section_24a_votes: 0, 
					total_votes: 0
				},
				vote_count: 0
			};
		}
		if (d.properties.winner) {
			var winner = d.properties.winner;
		} else {
			winner = {party: "none", votes: 0};
		}

		d3.selectAll(".province").style("opacity", "0.8");
		d3.selectAll(".municipality").style("opacity", "0.8");
		d3.selectAll(".ward").style("opacity", "0.8");
		d3.select("#c4sa_" + d.id).style("opacity", "1");
		d3.selectAll(".party").classed("active", false);
		
		d3.select("#" + safe_id(winner.party)).classed("active", true);

		d3.select("#c4sa_hoverblurb").text(winner.party + " " + Math.round(winner.perc * 100) + "%");
		d3.select("#c4sa_hovername").text(d.id);
		d3.select("#c4sa_demarcation_title").text(title);
		
		d3.select("#c4sa_section_24a_votes").text( num_format(results.meta.section_24a_votes) );
		d3.select("#c4sa_num_registered").text( num_format(results.meta.num_registered) );
		
		d3.select("#c4sa_special_votes").text( num_format(results.meta.special_votes) );
		d3.select("#c4sa_spoilt_votes").text( num_format(results.meta.spoilt_votes) );
		d3.select("#c4sa_total_votes").text( num_format(results.meta.total_votes) );
		var total_votes = results.meta.total_votes;
		d3.select("#c4sa_vote_results").html("");
		var tabsel = d3.select("#c4sa_vote_results")
			.selectAll("tr")
			.data(sort_votes(results.vote_count));
		var newtr = tabsel.enter()
			.append("tr")
			.attr("class", function(d) { return "party row-" + d[0].replace(/\s/g, "_").toLowerCase(); });
		newtr.append("td").text(function (d) { return d[0]; });
		newtr.append("td").text(function(d) { return num_format(d[1]) });
		newtr.append("td").text(function(d) { return perc_format(d[1] / total_votes) })
	}
};

function unhovered(d) {
	d3.select("#c4sa_hovername").text("");
	d3.select("#c4sa_hoverobj").remove();
	hovering = false;
};


function safe_id(s) {
	return s.replace(/[^A-Za-z0-9]/g,"");
}

function init_seats() {
	var seats=d3.select("#c4sa_seats_container");
	d3.json(nationalurl + year + "/", function(error, data) {
		var tmp = [];
		var tot = 0;
		for (party in data.results.vote_count) {
			tmp.push({ party: party, votes: data.results.vote_count[party] });
			tot += data.results.vote_count[party];
		}
		tmp.sort(function(a, b) { if (a.votes < b.votes) return 1; return -1; });
		var seat_count = 0;
		var seatdivs = d3.select("#c4sa_seats_container").selectAll("div").data(tmp).enter().append("div").attr("class", "party").attr("id", function(d) { return safe_id(d.party) }).each(
			function(d) {
				for(var x = 0; x < Math.round(d.votes / tot * 400); x++) {
					seat_count++;
					d3.select("#" + safe_id(d.party)).append("div").attr("class", "seat").style("background-color", function(d) {
						return colors[d.party];
					});
				}
			}
		).on("mousemove",
			function(d) {
				d3.selectAll("div.party").classed("active", false);
				d3.select("#" + safe_id(d.party)).classed("active", true);
				var el = d3.select("#c4sa_seats_overlay");
				el.select("#c4sa_party").text(d.party);
				el.select("#c4sa_seats_votes").text(num_format(d.votes));
				el.select("#c4sa_seats_seats").text(Math.ceil(d.votes / tot * 400));
				el.select("#c4sa_seats_percentage").text(perc_format(d.votes / tot));
				el.style("display", "block");
				el.style("top", (d3.event.pageY + 10) + "px");
				el.style("left", (d3.event.pageX - 100) + "px");
				d3.selectAll(".province").style("opacity", "0.8");
				d3.selectAll(".municipality").style("opacity", "0.8");
				d3.selectAll(".ward").style("opacity", "0.8");
				d3.selectAll(".winner_" + safe_id(d.party)).style("opacity", "1");
			}
		).on("mouseout", function(d) {
			d3.select("#c4sa_seats_overlay").style("display", "none");
		});
	});
}

init();
