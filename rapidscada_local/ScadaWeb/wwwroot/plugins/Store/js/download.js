const STORE_URL = "https://rapidscada.net/store/";
var lang = "";
var phrases = {};
var modules = [];
var pager = {};

function loadModules(opt_filter) {
    pager.pageIndex = 0;
    hideModules();
    showInfo(phrases.loading);

    searchModules(opt_filter, function (dto) {
        if (dto.ok) {
            modules = dto.data;

            if (modules.length > 0) {
                hideMessage();
                showModules();
            } else {
                hideModules();
                showWarning(phrases.noData);
            }
        } else {
            hideModules();
            showError(phrases.loadError);
            console.error(dto.msg);
        }
    });
}

function searchModules(filter, callback) {
    let searchParams = new URLSearchParams({
        lang: lang,
        filter: filter ?? ""
    });

    fetch(STORE_URL + "api/modules/search?" + searchParams.toString())
        .then(response => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            return response.json();
        })
        .then(data => callback.call(this, Dto.success(data)))
        .catch(error => callback.call(this, Dto.fail(error.message)));
}

function showModules() {
    let tbodyElem = $("<tbody></tbody>");
    let modulesOnPage = pager.sliceItems(modules);

    for (let module of modulesOnPage) {
        let rowElem = $("<tr></tr>").appendTo(tbodyElem);

        // name
        let nameCell = $("<td></td>").appendTo(rowElem);
        $("<span></span>").text(module.name).appendTo(nameCell);

        if (module.new) {
            let newSpan = $("<span class='badge text-light bg-info'></span>").text(phrases.new);
            nameCell.append(" ").append(newSpan);
        }

        if (module.recommended) {
            let recSpan = $("<span class='badge text-light bg-info'><i class='fa-regular fa-thumbs-up'></i></span>");
            nameCell.append(" ").append(recSpan);
        }

        let detailsLink = $("<a></a>", {
            href: STORE_URL + "Module/" + lang + "/" + module.code,
            target: "_blank",
            text: phrases.details
        });
        $("<div></div>").append(detailsLink).appendTo(nameCell);

        // description
        $("<td></td>").text(module.shortDescr).appendTo(rowElem);

        // price
        let priceCell = $("<td></td>").appendTo(rowElem);

        for (let price of module.prices) {
            $("<div></div>").html(price).appendTo(priceCell);
        }

        // author
        $("<td></td>").text(module.author).appendTo(rowElem);
    }

    let divResult = $("#divResult");
    divResult.find("tbody").remove();
    divResult.find("table").append(tbodyElem);

    pager.update(modules.length);
    divResult.removeClass("hidden");
}

function hideModules() {
    $("#divResult").addClass("hidden");
}

function showInfo(message) {
    setMessage("alert alert-info", message);
}

function showWarning(message) {
    setMessage("alert alert-warning", message);
}

function showError(message) {
    setMessage("alert alert-danger", message);
}

function hideMessage() {
    setMessage("hidden", "");
}

function setMessage(className, message) {
    $("#divMessage")
        .removeClass()
        .addClass(className)
        .text(message);
}

function bindEvents() {
    $("#btnSearch").on("click", function () {
        loadModules($("#txtFilter").val());
        return false;
    });

    pager.pagerElem.on(ClientPager.PAGE_CLICK_EVENT, function () {
        showModules();
    });
}

$(document).ready(function () {
    pager = new ClientPager("navPager");
    loadModules();
    bindEvents();
});
