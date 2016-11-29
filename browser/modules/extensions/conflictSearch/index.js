/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

/**
 *
 * @type {*|exports|module.exports}
 */
var cloud;

/**
 *
 * @type {*|exports|module.exports}
 */
var meta;

/**
 *
 * @type {*|exports|module.exports}
 */
var setting;

/**
 *
 * @type {*|exports|module.exports}
 */
var utils;

/**
 *
 * @type {*|exports|module.exports}
 */
var infoClick;

/**
 *
 * @type {*|exports|module.exports}
 */
var conflictInfoClick;

/**
 *
 * @type {*|exports|module.exports}
 */
var switchLayer;

/**
 *
 * @type {*|exports|module.exports}
 */
var search = require('./../../search/danish');

/**
 *
 * @type {*|exports|module.exports}
 */
var backboneEvents;

/**
 *
 * @type {*|exports|module.exports}
 */
var urlparser = require('./../../urlparser');

/**
 *
 * @type {exports|module.exports}
 */
var jsts = require('jsts');

/**
 *
 * @type {*|exports|module.exports}
 */
var reproject = require('reproject');

/**
 * @type {string}
 */
var db = urlparser.db;

/**
 * @type {string}
 */
var schema = urlparser.schema;

/**
 * @type {*|exports|module.exports}
 */
var noUiSlider = require('nouislider');

/**
 *
 * @type {Element}
 */
var bufferSlider;

/**
 *
 * @type {Element}
 */
var bufferValue;

/**
 * @type {*|exports|module.exports}
 */
var drawControl;

/**
 * @type {*|exports|module.exports}
 */
var socketId;

/**
 *
 * @type {L.FeatureGroup}
 */
var drawnItems = new L.FeatureGroup();

/**
 *
 * @type {L.FeatureGroup}
 */
var bufferItems = new L.FeatureGroup();

/**
 *
 * @type {L.FeatureGroup}
 */
var dataItems = new L.FeatureGroup();

/**
 *
 * @type {string}
 */
var BACKEND = require('../../../../config/config.js').backend;

/**
 *
 */
var dataStore;

/**
 *
 */
var xhr;

/**
 *
 * @type {string}
 */
var id = "conflict-custom-search";

/**
 *
 */
var Terraformer = require('terraformer-wkt-parser');

/**
 *
 * @type {array}
 */
var modules;

/**
 *
 * @private
 */
var _clearDrawItems = function () {
    drawnItems.clearLayers();
    bufferItems.clearLayers();
};

/**
 *
 * @private
 */
var _clearDataItems = function () {
    dataItems.clearLayers();
};

/**
 *
 * @private
 */
var _clearInfoItems = function () {
    infoItems.clearLayers();
    $("#info-tab").empty();
    $("#info-pane").empty();
    $('#modal-info-body').hide();
};

/**
 *
 * @private
 */
var _clearAllItems = function () {
    _clearDrawItems();
    //_clearInfoItems();
    _clearDataItems();
};


/**
 *
 * @private
 */
var _zoomToFeature = function (table, key, fid) {
    try {
        dataStore.abort();
    } catch (e) {
    }
    var onLoad = function () {
        _clearDataItems();
        //clearInfoItems();
        dataItems.addLayer(this.layer);
        cloud.zoomToExtentOfgeoJsonStore(this);
    };
    switch (BACKEND) {
        case "gc2":
            dataStore = new geocloud.sqlStore({
                jsonp: false,
                method: "POST",
                host: "",
                db: db,
                uri: "/api/sql",
                sql: "SELECT * FROM " + table + " WHERE " + key + "=" + fid,
                onLoad: onLoad
            });
            break;
        case "cartodb":
            dataStore = new geocloud.cartoDbStore({
                db: db,
                sql: "SELECT * FROM (" + table + ") as foo WHERE " + key + "=" + fid,
                onLoad: onLoad
            });
            break;
    }
    dataStore.load();
};

/**
 *
 * @type set: module.exports.set, init: module.exports.init
 */
module.exports = module.exports = {
    set: function (o) {
        cloud = o.cloud;
        setting = o.setting;
        utils = o.utils;
        meta = o.meta;
        infoClick = o.infoClick;
        switchLayer = o.switchLayer;
        backboneEvents = o.backboneEvents;
        socketId = o.socketId;
        cloud.map.addLayer(drawnItems);
        cloud.map.addLayer(bufferItems);
        cloud.map.addLayer(dataItems);
        modules = o;
        return this;
    },
    init: function () {
        var metaData, me = this;

        // Turn off if advanced info or drawing is activated
        backboneEvents.get().on("off:conflict on:advancedInfo on:drawing", function () {
            me.off();
        });
        utils.createMainTab("conflict", "Konfliktsøgning");
        $("#conflict").append(dom);

        // DOM created

        $("#conflict-btn").on("click", function () {
            me.control();
        });

        search.init(function () {
            _clearDrawItems();
            _clearDataItems()
            drawnItems.addLayer(this.layer._layers[Object.keys(this.layer._layers)[0]]);
            cloud.zoomToExtentOfgeoJsonStore(this);
            if (cloud.map.getZoom() > 17) {
                cloud.map.setZoom(17);
            }
            me.makeSearch();
        }, id);

        bufferSlider = document.getElementById('conflict-buffer-slider');
        bufferValue = document.getElementById('conflict-buffer-value');
        try {
            noUiSlider.create(bufferSlider, {
                start: 40,
                connect: "lower",
                step: 1,
                range: {
                    min: 0,
                    max: 500
                }
            });
            bufferSlider.noUiSlider.on('update', _.debounce(function (values, handle) {
                bufferValue.value = values[handle];
                bufferItems.clearLayers();
                me.makeSearch()

            }, 300));
            // When the input changes, set the slider value
            bufferValue.addEventListener('change', function () {
                bufferSlider.noUiSlider.set([this.value]);
            });
        } catch (e){}

        backboneEvents.get().on("ready:meta", function () {
            metaData = meta.getMetaData();
        })
    },
    control: function () {
        var me = this;
        if ($("#conflict-btn").is(':checked')) {
            conflictInfoClick = modules.extensions.conflictSearch.infoClick;
            conflictInfoClick.active(true);

            backboneEvents.get().trigger("on:conflict");

            // Trigger off events for info, drawing and advanced info
            backboneEvents.get().trigger("off:drawing");
            backboneEvents.get().trigger("off:advancedInfo");
            backboneEvents.get().trigger("off:infoClick");

            $("#conflict-buffer").show();
            $("#conflict .nav").show();
            $("#conflict .tab-content").show();

            // Reset layer made by clickInfo
            infoClick.reset();
            L.drawLocal = require('./../../drawLocales/advancedInfo.js');
            drawControl = new L.Control.Draw({
                position: 'topright',
                draw: {
                    polygon: {
                        title: 'Draw a polygon!',
                        allowIntersection: false,
                        drawError: {
                            color: '#b00b00',
                            timeout: 1000
                        },
                        shapeOptions: {
                            color: '#662d91',
                            fillOpacity: 0
                        },
                        showArea: true
                    },
                    polyline: {
                        metric: true,
                        shapeOptions: {
                            color: '#662d91',
                            fillOpacity: 0
                        }
                    },
                    circle: {
                        shapeOptions: {
                            color: '#662d91',
                            fillOpacity: 0
                        }
                    },
                    rectangle: {
                        shapeOptions: {
                            color: '#662d91',
                            fillOpacity: 0
                        }
                    },
                    marker: true
                },
                edit: {
                    featureGroup: drawnItems,
                    remove: false
                }
            });

            cloud.map.addControl(drawControl);
            // Unbind events
            cloud.map.off('draw:created');
            cloud.map.off('draw:drawstart');
            cloud.map.off('draw:drawstop');
            cloud.map.off('draw:editstart');
            // Bind events
            cloud.map.on('draw:created', function (e) {
                e.layer._vidi_type = "query_draw";
                drawnItems.addLayer(e.layer);
            });
            cloud.map.on('draw:drawstart', function (e) {
                _clearDrawItems();
                _clearDataItems()
            });
            cloud.map.on('draw:drawstop', function (e) {
                me.makeSearch();
            });
            cloud.map.on('draw:editstop', function (e) {
                me.makeSearch();
            });
            cloud.map.on('draw:editstart', function (e) {
                bufferItems.clearLayers();
            });
            var po = $('.leaflet-draw-toolbar-top').popover({content: __("Use these tools for querying the overlay maps."), placement: "left"});
            po.popover("show");
            setTimeout(function () {
                po.popover("hide");
            }, 2500);
        } else {
            backboneEvents.get().trigger("off:conflict");
        }
    },
    off: function () {
        // Clean up
        console.log("Stopping conflict");
        _clearAllItems();
        $("#conflict-buffer").hide();
        $("#conflict .nav").hide();
        $("#conflict .tab-content").hide();
        $("#conflict-btn").prop("checked", false);

        $("#hits-content tbody").empty();
        $("#hits-data").empty();
        $("#nohits-content tbody").empty();
        $("#error-content tbody").empty();

        $('#conflict-result-content a[href="#hits-content"] span').empty();
        $('#conflict-result-content a[href="#nohits-content"] span').empty();
        $('#conflict-result-content a[href="#error-content"] span').empty();

        // Turn info click on again
        backboneEvents.get().trigger("on:infoClick");
        try {
            conflictInfoClick.reset();
            conflictInfoClick.active(false);
        } catch (e) {
        }
        // Unbind events
        cloud.map.off('draw:created');
        cloud.map.off('draw:drawstart');
        cloud.map.off('draw:drawstop');
        cloud.map.off('draw:editstart');
        try {
            cloud.map.removeControl(drawControl);
        } catch (e) {
        }
    },
    makeSearch: function (callBack) {
        var primitive, coord,
            layer, buffer = parseFloat($("#conflict-buffer-value").val()),
            hitsTable = $("#hits-content tbody"),
            noHitsTable = $("#nohits-content tbody"),
            errorTable = $("#error-content tbody"),
            hitsData = $("#hits-data"),
            row, fileId, searchFinish, geomStr,
            metaDataKeys = meta.getMetaDataKeys(),
            visibleLayers = cloud.getVisibleLayers().split(";");

        hitsTable.empty();
        noHitsTable.empty();
        errorTable.empty();
        hitsData.empty();

        try {
            xhr.abort();
        } catch (e) {
        }
        for (var prop in drawnItems._layers) {
            layer = drawnItems._layers[prop];
            break;
        }
        if (typeof layer === "undefined") {
            return;
        }
        if (typeof layer._mRadius !== "undefined") {
            if (typeof layer._mRadius !== "undefined") {
                buffer = buffer + layer._mRadius;
            }
        }
        primitive = layer.toGeoJSON();
        if (typeof primitive.features !== "undefined"){
            primitive = primitive.features[0];
        }
        if (primitive) {
            if (typeof layer.getBounds !== "undefined") {
                coord = layer.getBounds().getSouthWest();
            } else {
                coord = layer.getLatLng();
            }
            // Get utm zone
            var zone = require('./../../utmZone.js').getZone(coord.lat, coord.lng);
            var crss = {
                "proj": "+proj=utm +zone=" + zone + " +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
                "unproj": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs"
            };
            var reader = new jsts.io.GeoJSONReader();
            var writer = new jsts.io.GeoJSONWriter();
            var geom = reader.read(reproject.reproject(primitive, "unproj", "proj", crss));
            var buffer4326 = reproject.reproject(writer.write(geom.geometry.buffer(buffer)), "proj", "unproj", crss);
            var l = L.geoJson(buffer4326, {
                "color": "#ff7800",
                "weight": 1,
                "opacity": 1,
                "fillOpacity": 0.1,
                "dashArray": '5,3'
            }).addTo(bufferItems);
            l._layers[Object.keys(l._layers)[0]]._vidi_type = "query_buffer";
            xhr = $.ajax({
                method: "POST",
                url: "/api/extension/conflictSearch",
                data: "db=" + db + "&schema=" + schema + "&socketId=" + socketId.get() + "&layers=" + visibleLayers.join(",") + "&buffer=" + buffer + "&wkt=" + Terraformer.convert(primitive.geometry),
                scriptCharset: "utf-8",
                success: function (response) {
                    var hitsCount = 0, noHitsCount = 0, errorCount = 0;
                    $("#spinner span").hide();
                    $("#result-origin").html(response.text);
                    $('#conflict-main-tabs a[href="#conflict-result-content"]').tab('show');
                    $('#conflict-result-content a[href="#hits-content"]').tab('show');
                    $('#conflict-result .btn:first-child').attr("href", "/html?id=" + response.file)
                    fileId = response.file;
                    searchFinish = true;
                    //showPrintBtn();
                    //showGeomaticBtn();
                    $.each(response.hits, function (i, v) {
                            var table = i, table1, table2, tr, td, title;
                            console.log(table)
                            title = (typeof metaDataKeys[table].f_table_title !== "undefined" && metaDataKeys[table].f_table_title !== "" && metaDataKeys[table].f_table_title !== null) ? metaDataKeys[table].f_table_title : table;
                            if (v.error === null) {
                                if (metaDataKeys[table].meta_url) {
                                    title = "<a target='_blank' href='" + metaDataKeys[table].meta_url + "'>" + title + "</a>";
                                }
                                row = "<tr><td>" + title + "</td><td>" + v.hits + "</td><td><input type='checkbox' data-gc2-id='" + i + "' " + ($.inArray(i, visibleLayers) > -1 ? "checked" : "") + "></td></tr>";
                                if (v.hits > 0) {
                                    hitsTable.append(row);
                                    hitsCount++;
                                    if (v.data.length > 0) {
                                        table1 = $("<table class='table table-data'/>");
                                        hitsData.append("<h3>" + title + " (" + v.data.length + ")</h3>");
                                        $.each(v.data, function (u, row) {
                                            var key = null, fid = null;
                                            tr = $("<tr/>");
                                            td = $("<td/>");
                                            table2 = $("<table class='table'/>");
                                            $.each(row, function (n, field) {
                                                if (!field.key) {
                                                    table2.append("<tr><td style='width: 100px'>" + field.alias + "</td><td>" + field.value + "</td></tr>")
                                                } else {
                                                    key = field.name;
                                                    fid = field.value;
                                                }
                                            });
                                            td.append(table2);
                                            tr.append("<td class=''><button type='button' class='btn btn-default btn-xs zoom-to-feature' data-gc2-sf-table='" + (BACKEND === "cartodb" ? v.sql : i) + "' data-gc2-sf-key='" + key + "' data-gc2-sf-fid='" + fid + "'>#" + (u + 1) + " <i class='fa fa-search'></i></button></td>");
                                            tr.append(td);
                                            table1.append(tr);
                                        });
                                        hitsData.append(table1);

                                    } else {
                                        //Pass
                                    }
                                } else {
                                    noHitsTable.append(row);
                                    noHitsCount++;
                                }
                            } else {
                                row = "<tr><td>" + title + "</td><td>" + v.error + "</td></tr>";
                                errorTable.append(row);
                                errorCount++;
                            }
                            $('#conflict-result-content a[href="#hits-content"] span').html(" (" + hitsCount + ")");
                            $('#conflict-result-content a[href="#nohits-content"] span').html(" (" + noHitsCount + ")");
                            $('#conflict-result-content a[href="#error-content"] span').html(" (" + errorCount + ")");
                        }
                    );
                    $(".zoom-to-feature").click(function (e) {
                        _zoomToFeature($(this).data('gc2-sf-table'), $(this).data('gc2-sf-key'), $(this).data('gc2-sf-fid'));
                        e.stopPropagation();
                    });
                    L.geoJson(response.geom, {
                        "color": "#ff7800",
                        "weight": 1,
                        "opacity": 0.65,
                        "dashArray": '5,3'
                    });
                    geomStr = response.geom;
                    if (callBack) {
                        callBack();
                    }
                }
            })
        }
    },
    addDrawing: function (layer) {
        drawnItems.addLayer(layer);
    },
    clearDrawing: function () {
        _clearDrawItems();
    }

};

var dom = '<div role="tabpanel"><div class="panel panel-default"><div class="panel-body">' +
    '<div class="togglebutton">' +
    '<label>' +
    '<input id="conflict-btn" type="checkbox">Activate conflict search' +
    '</label>' +
    '</div>' +
    '<div id="conflict-buffer" style="display: none">' +
    '<div>' +
    '<label for="conflict-buffer-value" class="control-label">Buffer</label>' +
    '<input id="conflict-buffer-value" class="form-control">' +
    '<div id="conflict-buffer-slider" class="slider shor"></div>' +
    '</div>' +
    '</div>' +
    '<ul class="nav nav-tabs" role="tablist" id="conflict-main-tabs" style="display: none">' +
    '<li role="presentation" class="active"><a href="#conflict-search-content" aria-controls="" role="tab" data-toggle="tab">Search</a></li>' +
    '<li role="presentation"><a href="#conflict-result-content" aria-controls="" role="tab" data-toggle="tab">Result</a></li>' +
    '<li role="presentation"><a href="#conflict-info-content" aria-controls="" role="tab" data-toggle="tab">Info</a></li>' +
    '<li role="presentation"><a href="#conflict-log-content" aria-controls="" role="tab" data-toggle="tab">Log</a></li>' +
    '</ul>' +
    '<!-- Tab panes -->' +
    '<div class="tab-content" style="display: none">' +
    '<div role="tabpanel" class="tab-pane active" id="conflict-search-content" style="height: 400px">' +
    '<div class="places">' +
    '<input id="' + id + '" class="' + id + ' typeahead" type="text" placeholder="Address">' +
    '</div>' +
    '</div>' +
    '<div role="tabpanel" class="tab-pane" id="conflict-result-content">' +
    '<div id="conflict-result">' +
    '<div id="conflict-result-origin"></div>' +
    '<button class="btn btn-primary btn-xs" id="conflict-print-btn" disabled="true">Print report<img src=\'http://www.gifstache.com/images/ajax_loader.gif\' class=\'print-spinner\'/></button>' +
    '<button class="btn btn-primary btn-xs" id="conflict-geomatic-btn" disabled="true">Hent Geomatic<img src=\'http://www.gifstache.com/images/ajax_loader.gif\' class=\'print-spinner\'/></button>' +
    '<div role="tabpanel">' +
    '<!-- Nav tabs -->' +
    '<ul class="nav nav-tabs" role="tablist">' +
    '<li role="presentation" class="active"><a href="#hits-content" aria-controls="hits-content" role="tab" data-toggle="tab">With conflicts<span></span></a></li>' +
    '<li role="presentation"><a href="#hits-data-content" aria-controls="hits-data-content" role="tab" data-toggle="tab">Data from conflicts<span></span></a></li>' +
    '<li role="presentation"><a href="#nohits-content" aria-controls="nohits-content" role="tab" data-toggle="tab">Without conflicts<span></span></a></li>' +
    '<li role="presentation"><a href="#error-content" aria-controls="error-content" role="tab" data-toggle="tab">Errors<span></span></a></li>' +
    '</ul>' +
    '<div class="tab-content">' +
    '<div role="tabpanel" class="tab-pane active" id="hits-content">' +
    '<div id="hits">' +
    '<table class="table table-hover">' +
    '<thead>' +
    '<tr>' +
    '<th>Layer</th>' +
    '<th>Number of objects</th>' +
    '<th>Show</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody></tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '<div role="tabpanel" class="tab-pane" id="hits-data-content">' +
    '<div id="hits-data"></div>' +
    '</div>' +
    '<div role="tabpanel" class="tab-pane" id="nohits-content">' +
    '<div id="nohits">' +
    '<table class="table table-hover">' +
    '<thead>' +
    '<tr>' +
    '<th>Layer</th>' +
    '<th>Number of objects</th>' +
    '<th>Show</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody></tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '<div role="tabpanel" class="tab-pane" id="error-content">' +
    '<div id="error">' +
    '<table class="table table-hover">' +
    '<thead>' +
    '<tr>' +
    '<th>Layer</th>' +
    '<th>Severity</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody></tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div role="tabpanel" class="tab-pane" id="conflict-info-content">' +
    '<div class="alert alert-info" role="alert">Info text</div>' +
    '<div id="conflict-info-box">' +
    '<div id="conflict-modal-info-body">' +
    '<ul class="nav nav-tabs" id="conflict-info-tab"></ul>' +
    '<div class="tab-content" id="conflict-info-pane"></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div role="tabpanel" class="tab-pane" id="conflict-log-content">' +
    '<textarea style="width: 100%" rows="8" id="conflict-console"></textarea>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>';