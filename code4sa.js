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

// var apiurl = "http://localhost:5000/national/";
// var mapurl = "http://localhost:8080/political/";

var apiurl = "http://iec-v2.code4sa.org/national/";
var mapurl = "http://maps.code4sa.org/political/";

var provinceurl = apiurl + "2009/province/";
var municipalurl = apiurl + "2009/municipality/?all_results=true";
var wardurl = apiurl + "2009/ward/?all_results=true";

var width = 500;
var height = 450;

var curCode = "";
var curBallot = "";

var curElem;
var history = [];

var num_format = d3.format(",");
var perc_format = d3.format(".2%");

var projection = d3.geo.conicEqualArea()
    .center([0, -28.5])
    .rotate([-24.5, 0])
    .parallels([-25.5, -31.5])
    .scale(1800)
    .translate([width/2, height/2]);

 var path = d3.geo.path().projection(projection);

var svg = d3.select("div#c4sa_map_container").select("svg");
svg.attr("viewBox", "0 0 " + width + " " + (height + 100)).attr("id", "c4sa_svg");

var mapg = svg.select("g#c4sa_map")
	.on("mousemove", move_overlay)
	.on("mouseout", hide_overlay);
var selph = mapg.select("g#c4sa_selph");
var hoverph = mapg.select("g#c4sa_hoverph");
var borderg = mapg.select("g#c4sa_borders");

var province_job = d3.json(mapurl + "province?quantization=5000");

var province_data_job = d3.json(provinceurl);
var municipal_data_job = d3.json(municipalurl);
var ward_data_job = d3.json(wardurl);

var level = 0;
var levels = ["province", "municipality", "ward"];
var levels_zoom = [1, 4, 15];
var wardscache = {};

var linear_scale = d3.scale.linear().domain([0.2, 1]);

// var colors = { "AFRICAN NATIONAL CONGRESS": 30, "DEMOCRATIC ALLIANCE": 190, "INKATHA FREEDOM PARTY": 270, "INDEPENDENT DEMOCRATS": 60, "CONGRESS OF THE PEOPLE": 90, "UNITED DEMOCRATIC MOVEMENT": 170 };

var colors = { "AFRICAN NATIONAL CONGRESS": "#008000", "DEMOCRATIC ALLIANCE": "#04599c", "INKATHA FREEDOM PARTY": "#911c1b", "INDEPENDENT DEMOCRATS": "#f87906", "CONGRESS OF THE PEOPLE": "#ffca08", "UNITED DEMOCRATIC MOVEMENT": "#770433", "VRYHEIDSFRONT PLUS": "#ff00a4", "AFRICAN CHRISTIAN DEMOCRATIC PARTY": "#adfc00", "UNITED CHRISTIAN DEMOCRATIC PARTY": "#AE00FF", "PAN AFRICANIST CONGRESS OF AZANIA": "#895E46", "MINORITY FRONT": "", "AZANIAN PEOPLE'S ORGANISATION": "#728915", "AFRICAN PEOPLE'S CONVENTION": "#895E46", "MOVEMENT DEMOCRATIC PARTY": "#4A5C72", "AL JAMA-AH": "#666", "ECONOMIC FREEDOM FIGHTERS": "#ed1b24" };

function update_map(mapdata, data, demarcation) {
	//Let's prep the area
	var demarcg = mapg.select("g#c4sa_" + demarcation);
	demarcg.selectAll("g").remove();
	var area = demarcg.insert("g").attr("class", "c4sa_area");
	var border = demarcg.insert("g").attr("class", "c4sa_border");

	//Add some data
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

	return true;
}

queue()
	.defer(province_job.get)
	.defer(province_data_job.get)
	.await(function (error, provinces, province_data) {
		province_data = province_data.results;
		update_map(provinces, province_data, "province");
	});

function progressive_load(d) {
	var areag = mapg.select("g#c4sa_areas");
	
	if (level == 1) {
		//Load Minicipalities
		var municipality_job = d3.json(mapurl + "municipality?quantization=3000&filter[province]=" + d.id);
		var municipality_data_job = d3.json(apiurl + "2009/municipality/?all_results=true&province=" + d.id);
		queue()
			.defer(municipality_job.get)
			.defer(municipality_data_job.get)
			.await(function(error, municipality, municipality_data) {
				// areag.selectAll("." + d.id).style("display", "none");
				municipality_data = municipality_data.results;
				update_map(municipality, municipality_data, "municipality");
				
			}
		);
		
	}
	if (level == 2) {
		//Load Wards
		var ward_job = d3.json(mapurl + "ward?quantization=3000&filter[municipality]=" + d.id);
		var ward_data_job = d3.json(apiurl + "2009/ward/?all_results=true&municipality=" + d.id);
		//Fire the queue job
		queue()
			.defer(ward_job.get)
			.defer(ward_data_job.get)
			.await(function (error, ward, ward_data) {
				areag.selectAll("." + d.id).style("display", "none");
				areag.selectAll("." + d.properties.PROVINCE).style("display", "none");
				ward_data = ward_data.results;
				update_map(ward, ward_data, "ward");
			}
		);
	}
}

function hide_parents(d) {
	var areag = mapg.select("g#c4sa_areas");
	// console.log(level);
	switch(level) {
		case 0:
			return;
		case 1: //Municipal level - hide province
			// areag.selectAll("." + )
			console.log(d);
			d3.selectAll(".province")
				.style("display", "inherit");
			d3.selectAll(".municipality")
				.style("display", "inherit");
			// console.log(d.properties);
			d3.select("#c4sa_" + d.properties.province).style("display", "none");
			d3.select("#c4sa_" + d.properties.municipality).style("display", "none");
			return;
		case 2: //Ward level - hide province and municipality
			console.log(3, d);
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
	// d3.selectAll(".province")
	// 	.style("display", "inherit");
	
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
    		hide_parents(d);
    		// if (level < 3) {
    		// 	d3.selectAll("#" + d.id).style("display", "none");
    		// }
    	});
	mapg.attr("class", "level-" + level);
	// d3.selectAll("#" + d.id).style("display", "none");
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
		console.log(level);
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
	// console.log(vote_count);
	for(var party in vote_count) {
		// console.log(party, vote_count[party]);
		// tot += vote_count[party];
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
	
	// console.log(x, y);
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
		// d3.select("#c4sa_vote_results").text("<tr><td>Party</td><td>Votes</td><td>Perc</td></tr>");
		d3.select("#c4sa_vote_results").html("");
		var tabsel = d3.select("#c4sa_vote_results")
			.selectAll("tr")
			.data(sort_votes(results.vote_count));
		// console.log(tabsel.data());
		var newtr = tabsel.enter()
			.append("tr")
			.attr("class", function(d) { return "party row-" + d[0].replace(/\s/g, "_").toLowerCase(); });
		newtr.append("td").text(function (d) { return d[0]; });
		newtr.append("td").text(function(d) { return num_format(d[1]) });
		newtr.append("td").text(function(d) { return perc_format(d[1] / total_votes) })
		// }
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

var seats=d3.select("#c4sa_seats_container");
d3.json(apiurl + "2009/", function(error, data) {
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
			// console.log(seat_count);
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
				// console.log(d)});
	// seatdivs.selectAll("div").enter().append("div").text(function(d) {console.log(d)});
});
