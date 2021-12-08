// global vars, ugh
let pdfFileName = "";
let pdfFile = null;
let textFileName = "";
let textFileExt = "";
let cols1text = [];
let cols2numbers = [];
let colorCounter = 0;

const SERVER_URL = "http://127.0.0.1:8000/cgi-bin/";
const LOCAL_STORAGE = {
  MARKED_UP_TEXT: "marked_up_text",
  TEXT_FILE_NAME: "anno2filename",
  PDF_IFRAME_SRC: "excite_pdf_iframe_source"
}


// array for colors definition
const openSpanValues = [
  '<span data-tag="ref" style="background-color: rgb(255, 255, 153);">',
  '<span data-tag="ref" style="background-color: rgb(252, 201, 108);">',
  '<span data-tag="ref" style="background-color: rgb(236, 184, 249);">',
  '<span data-tag="ref" style="background-color: rgb(152, 230, 249);">',
  '<span data-tag="ref" style="background-color: rgb(135, 245, 168);">',
  '<span data-tag="ref" style="background-color: rgb(244, 132, 112);">',
  '<span data-tag="ref" style="background-color: rgb(111, 252, 226);">'];
const spanColors = [
  "#ffff99",
  "#fcc96c",
  "#ecb8f9",
  "#98e6f9",
  "#87f5a8",
  "#f48470",
  "#6ffce2"
];
const otherSpanValue = `<span data-tag="oth" style="background-color: rgb(162, 165, 165);">`
const otherColor = "#a2a5a5";

class Actions {
  static upload() {
    colorCounter = 0;
    const uploadBtn = document.getElementById("btn-upload");
    switch (uploadBtn.files.length) {
      case 0:
        alert("Please select at least one file.");
        return false;
      case 1:
      case 2:
        break;
      default:
        alert('Please select less than 3 files.');
        return false;
    }
    const validExts = ["pdf", "txt", "csv"];
    for (let file of uploadBtn.files) {
      let filename = file.name;
      let fileExt = filename.split('.').pop();
      if (!validExts.includes(fileExt)) {
        alert(fileExt + " has an invalid type, valid types are [" + validExts.toString() + "].");
        return;
      }
      if (fileExt === 'pdf') {
        document.getElementById("pdfSize").innerHTML = filename;
        pdfFileName = filename;
        pdfFile = file;
        let tmppath = URL.createObjectURL(file);
        document.getElementById('pdfiframe').src = "web/viewer.html?file=" + tmppath;
        $("#btndelpdf").show();
        $("#btn-exparser").prop("disabled", false)
      } else {
        const fileReader = new FileReader();
        fileReader.onload = (e) => {
          let text = String(e.target.result);
          textFileName = filename;
          textFileExt = fileExt;
          document.getElementById("txtSize").innerHTML = textFileName;
          localStorage.setItem(LOCAL_STORAGE.MARKED_UP_TEXT, text);
          localStorage.setItem(LOCAL_STORAGE.TEXT_FILE_NAME, textFileName);
          GUI.setTextContent(text);
        }
        fileReader.readAsText(file, "UTF-8");
      }
    }

    if (textFileName && pdfFileName) {
      let textFileNameWithoutExt = textFileName.split('.').slice(0, -1).join(".");
      if (textFileNameWithoutExt !== pdfFileName.substr(0, textFileNameWithoutExt.length)) {
        let message = "Text file and PDF file seem to belong to different documents."
        alert(message);
      }
    }
  }

  static addTag(tag_name, wholeLine = false) {
    let sel = window.getSelection();
    if (sel.toString() === "") return;
    if (wholeLine) {
      sel.setBaseAndExtent(sel.anchorNode, 0, sel.focusNode, sel.focusNode.length);
    }
    // prevent nesting of tags except <oth> in <ref>
    let node = sel.focusNode;
    do {
      if (node.dataset) {
        let tag = node.dataset.tag;
        if (tag && !(tag_name === "oth" && tag === "ref")) {
          return;
        }
      }
      node = node.parentNode;
    } while (node)
    let parentNode = document.createElement("span");
    parentNode.setAttribute("data-tag", tag_name);
    let backgroundColor;
    if (tag_name === 'ref') {
      backgroundColor = spanColors[colorCounter];
      colorCounter = ++colorCounter % 6;
    } else {
      backgroundColor = otherColor;
    }
    parentNode.style.backgroundColor = backgroundColor;
    sel.getRangeAt(0).surroundContents(parentNode);
    GUI.updateTaggedText()
  }

  static removeTag() {
    let sel = window.getSelection();
    if (!sel) return;
    let el = sel.focusNode;
    while (el) {
      if (el.dataset && el.dataset.tag) break;
      el = el.parentElement;
    }
    if (!el) return;
    $(el).contents().unwrap();
    GUI.updateTaggedText();
  }

  static checkResult(result) {
    if (result.error) {
      GUI.hideSpinner();
      alert("Error: " + result.error);
      return false;
    }
    if (!result.success) {
      alert("Invalid response.")
      return false;
    }
    return result
  }

  static async run_exparser() {
    if (!confirm("Do you really want to run exparser to identify references in this document?")) {
      return;
    }
    // 1. file upload
    let formData = new FormData();
    formData.append("file", pdfFile);
    GUI.showSpinner("Uploading file...");
    let result = await (await fetch(`${SERVER_URL}/upload.py`, {
      method: 'post',
      body: formData
    })).json();
    if (!this.checkResult(result)) return;
    // 2. layout
    GUI.showSpinner("Analyzing Layout...");
    let filenameNoExt = pdfFileName.split('.').slice(0, -1).join(".");
    let url = `${SERVER_URL}/excite.py?command=layout&file=${filenameNoExt}`
    result = await (await fetch(url)).json();
    if (!this.checkResult(result)) return;
    let layoutDoc = result.success;
    // 3. reference identification
    GUI.showSpinner("Identifying references, this will take a while...");
    url = `${SERVER_URL}/excite.py?command=exparser&file=${filenameNoExt}`
    result = await (await fetch(url)).json();
    GUI.hideSpinner();
    if (!this.checkResult(result)) return;
    let refs = result.success;

    // combine layout doc and references
    let words = layoutDoc.replace(/\n/g, "~~~CR~~~ ").split(" ");
    refs = refs.split('\n').filter(Boolean);
    for (let ref of refs) {
      let refWords = ref.split(" ");
      // try to match each occurrence of the first word of the reference
      // this currently misses words of the end of line
      let indices = words.map((word, index) => word === refWords[0] ? index : '').filter(String);
      for (let index of indices) {
        let i;
        for (i = 1; i < refWords.length; i++) {
          // compare ref word with punctuation removed ...
          let refWord = refWords[i].replace(/\p{P}/gu, "").trim();
          // ... with current word without punctuation and without the layout stuff
          let currWord = words[index + i]
            .replace(/\p{P}/gu, "")
            .replace(/(\t[^\t]+){6}/, "")
            .trim();
          // if word contains hyphen, join with next word if exists
          if (currWord.match(/\p{Pd}/gu) && words[index + i + 1]) {
            currWord = currWord + words[index + i + 1]
              .replace(/\p{P}/gu, "")
              .replace(/(\t[^\t]+){6}/, "")
              .trim();
          }
          if (refWord === currWord) continue;
          // not found
          break;
        }
        if (i === refWords.length) {
          // found! add tags
          words[index] = "<ref>" + words[index];
          words[index + i - 1] += "</ref>";
        }
      }
    }
    textFileName = pdfFileName.replace(".pdf", ".csv");
    $("#txtSize").text(textFileName);
    textFileExt = "csv";
    layoutDoc = words.join(" ").replace(/~~~CR~~~/g, "\n")
    GUI.setTextContent(layoutDoc);
  }

  static export() {
    if (!textFileName) return;
    Utils.download(GUI.getTextToExport(), textFileName);
  }

  static async save() {
    if (!textFileName) return;
    let data = GUI.getTextToExport();
    if (!data.includes("<ref>")) {
      alert("Text contains no markup.");
      return;
    }
    localStorage.setItem(LOCAL_STORAGE.MARKED_UP_TEXT, data);
    localStorage.setItem(LOCAL_STORAGE.TEXT_FILE_NAME, textFileName);
    GUI.showSpinner(`Saving ${textFileName} to training data.`);
    let body = JSON.stringify({
      filename: textFileName,
      type: "layout",
      data
    }) + "\n\n";
    let result = await (await fetch(`${SERVER_URL}/save.py`, {
      method: 'post',
      body
    })).json();
    GUI.hideSpinner();
    if (result.error) alert(result.error);
  }

  static open_in_seganno() {
    this.saveToLocalStorage();
    window.location.href = "../EXRef-Segmentation/index.html";
  }

  static saveToLocalStorage() {
    let text = GUI.getTextToExport();
    localStorage.setItem(LOCAL_STORAGE.MARKED_UP_TEXT, text);
    localStorage.setItem(LOCAL_STORAGE.TEXT_FILE_NAME, textFileName);
    localStorage.setItem(LOCAL_STORAGE.PDF_IFRAME_SRC, document.getElementById("pdfiframe").src);
  }
}

class Utils {

  static download(data, filename) {
    const file = new Blob([data], {type: 'text/xml;charset=utf-8;'});
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}


class GUI {

  static init() {
    // on page load
    $(document).ready(function () {
      // force remove PDF because loading saved src doesn't work yet
      document.getElementById("pdfiframe").src = /*
        localStorage.getItem(LOCAL_STORAGE.PDF_IFRAME_SRC ) || */ 'about:blank';
      // disable buttone (on reload)
      $("#btn-exparser").prop("disabled", true);
      $("#btn-export").prop("disabled", true);
      $("#btn-save").prop("disabled", true);
      $("#btn-seganno").prop("disabled", true);
      // get text from local storage
      let markedUpText = localStorage.getItem(LOCAL_STORAGE.MARKED_UP_TEXT);
      if (markedUpText) {
        textFileName = localStorage.getItem(LOCAL_STORAGE.TEXT_FILE_NAME)
        document.getElementById("txtSize").innerHTML = textFileName;
        GUI.setTextContent(markedUpText);
      }
      // long-pressing selects span
      $(document).ready(() => {
        let longpress = false;
        $(document).on('click', e => {
          if (!longpress) return;
          let sel = window.getSelection();
          if (!sel.focusNode || !sel.focusNode.parentElement) return;
          let p = sel.focusNode.parentElement;
          if (e.target !== p) return;
          if (p.dataset && p.dataset.tag) {
            sel.removeAllRanges();
            let range = document.createRange();
            range.selectNodeContents(p);
            sel.addRange(range)
          }
        });
        let startTime, endTime;
        $(document).on('pointerdown', function () {
          startTime = new Date().getTime();
        });
        $(document).on('pointerup', function () {
          endTime = new Date().getTime();
          longpress = (endTime - startTime >= 500);
        });
      });

      // show popup on select
      $(document).ready(() => {
        const contextMenu = $("#contextMenu");
        const contentLabel = $("#content1");
        contentLabel.on("pointerup", e => {
          let sel = window.getSelection();
          let node = sel.focusNode;
          let tag;
          while (node !== contentLabel) {
            if (node.dataset) {
              tag = node.dataset.tag;
              break;
            }
            node = node.parentNode;
          }
          $("#btn-ref-part").toggleClass("ui-state-disabled", Boolean(tag));
          $("#btn-ref-line").toggleClass("ui-state-disabled", Boolean(tag));
          $("#btn-oth").toggleClass("ui-state-disabled", !Boolean(tag) || tag === "oth");
          $("#btn-remove-tag").toggleClass("ui-state-disabled", !Boolean(tag));
          if (contextMenu.is(":visible") || !sel.toString().trim()) {
            contextMenu.hide();
            return;
          }
          contextMenu
            .show()
            .css({
              position: "absolute",
              left: e.pageX,
              top: e.pageY
            });
        });
        contextMenu.on("pointerup", () => setTimeout(() => {
          contextMenu.hide();
          window.getSelection().removeAllRanges();
        }, 100));
      })

      // save text before leaving the page
      window.onbeforeunload = Actions.saveToLocalStorage;
    });
  }

  static showSpinner(text) {
    $("#spinner").attr("data-text", text).addClass("is-active");
  }

  static hideSpinner() {
    $("#spinner").removeClass("is-active");
  }

  static removeTextFile() {
    document.getElementById("txtSize").innerHTML = "Load text file";
    $("#btndeltxt").hide();
    $("#btnfindNextRef").hide();
    $("#btnfindPrevRef").hide();
    document.getElementById("content1").innerHTML = "";
    document.getElementById("ptxaxml").innerHTML = "";
    textFileName = "";
    cols2numbers = [];
    localStorage.removeItem(LOCAL_STORAGE.TEXT_FILE_NAME);
    localStorage.removeItem(LOCAL_STORAGE.MARKED_UP_TEXT);
    $("#btn-export").prop("disabled", true);
    $("#btn-save").prop("disabled", true);
    $("#btn-seganno").prop("disabled", true);
  }

  static removePdfFile() {
    document.getElementById("pdfSize").innerHTML = "Load PDF file";
    $("#btndelpdf").hide();
    document.getElementById("pdfiframe").src = 'about:blank';
    pdfFileName = "";
    $("#btn-exparser").prop("disabled", true);
  }

  static findNextRef(offset = 1, btn) {
    const contentDiv = document.getElementById("content1");
    let currentRefNode = this.__currentRefNode;
    let nodes = Array.from(contentDiv.getElementsByTagName("span"));
    if (!currentRefNode) {
      currentRefNode = nodes.find(node => node.dataset.tag === "ref");
      if (!currentRefNode) return;
    } else {
      let index = nodes.findIndex(node => node === currentRefNode);
      if (index < 0 || index + offset === offset < 0 ? -1 : nodes.length) {
        return
      }
      currentRefNode = nodes[index + offset];
    }
    currentRefNode.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'start'});
    this.__currentRefNode = currentRefNode;
  }

  static updateTaggedText() {
    let regex1 = /<span data-tag="oth".*?>(.+?)<\/span>/g;
    let regex2 = /<span data-tag="ref".*?>(.+?)<\/span>/g;
    document.getElementById("ptxaxml").innerHTML =
      document.getElementById("content1").innerHTML
        .replace(regex1, "<oth>$1</oth>")
        .replace(regex2, "<ref>$1</ref>")
        .replace(/<br>/g, "\n")
        .replace(/</g, "&lt;");
  }

  static setTextContent(text) {
    let text_Lines = text
      .replace(/\r/g, "")
      .replace(/\n\n/g, '\n')
      .replace(/\n\n/g, '\n')
      .split('\n');
    let tagged_text = "";
    for (let i = 0; i < text_Lines.length; i++) {
      if (textFileName.endsWith(".csv")) {
        // we have layout info in the file, remove from text to re-add later
        let line_parts = text_Lines[i].split('\t');
        if (line_parts.length >= 7) {
          cols2numbers[i] = line_parts.slice(-6).join('\t');
          cols1text[i] = line_parts.slice(0, -6).join(' ');
        } else {
          cols1text[i] = text_Lines[i];
        }
      } else {
        cols1text[i] = text_Lines[i];
      }
      if (i === text_Lines.length - 1) {
        tagged_text = tagged_text + cols1text[i];
      } else {
        tagged_text = tagged_text + cols1text[i] + '<br>';
      }
    }
    let html = tagged_text;
    while (html.indexOf("<ref>") !== -1) {
      html = html.replace("</ref>", "</span>");
      html = html.replace('<ref>', openSpanValues[colorCounter]);
      colorCounter = ++colorCounter % 6;
    }
    while (html.indexOf("<oth>") !== -1) {
      html = html.replace("</oth>", "</span>");
      html = html.replace('<oth>', otherSpanValue);
    }
    document.getElementById("content1").innerHTML = html;
    document.getElementById("ptxaxml").innerHTML = tagged_text
      .replace(/<br>/g, "\n")
      .replace(/</g, "&lt;");
    // enable buttons
    $("#btndeltxt").show();
    $("#btnfindNextRef").show();
    $("#btnfindPrevRef").show();
    $("#btn-seganno").prop("disabled", false);
    $("#btn-save").prop("disabled", false);
    $("#btn-export").prop("disabled", false);
  }

  static getTextToExport() {
    GUI.updateTaggedText();
    let xmlText = document.getElementById("ptxaxml").innerHTML;
    let t1 = xmlText.split('\n');
    let t2 = [];
    let rowFirstColumn = '';
    let allFirstColumns = '';
    let start = '<ref>'
    let suffix = '</ref>'
    let other_suffix = '</oth>'
    for (let i = 0; i < t1.length; i++) {
      // allFirstColumns needed for extracting references part (only references)
      rowFirstColumn = t1[i];
      // add one space to the end of line if it is multi line ref and doesn't have hyphen or dash at end
      if (!(rowFirstColumn.substr(-suffix.length) === suffix) || (rowFirstColumn.substr(-other_suffix.length) === other_suffix))
        if (!(rowFirstColumn.substr(-1) === '-'))
          if (!(rowFirstColumn.substr(-1) === '.'))
            rowFirstColumn = rowFirstColumn + ' ';
      allFirstColumns = allFirstColumns + rowFirstColumn;
      // textToWrite2 is all layout with numbers
      if (i === t1.length - 1) {
        // no \n for last line
        if (typeof cols2numbers[i] != 'undefined') {
          t2[i] = t1[i] + '\t' + cols2numbers[i];
        } else {
          t2[i] = t1[i] + '\n'
        }
      } else {
        if (typeof cols2numbers[i] != 'undefined') {
          t2[i] = t1[i] + '\t' + cols2numbers[i] + '\n';
        } else {
          t2[i] = t1[i] + '\n'
        }
      }
    }
    // clean up
    t2 = t2.join("")
      .replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&quot;/g, '"')
      .replace(/&pos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();
    // return sanitized text
    return t2;
  }
}

// start
GUI.init();
