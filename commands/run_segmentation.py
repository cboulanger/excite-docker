import sys
import time
import traceback
from langdetect import detect
from EXparser.Segment_F1 import *
from JsonParser import *
from configs import *
from lib.logger import *


def call_Exparser_segmentation(model_dir: str, input_dir=None):
    load_model(model_dir)
    try:
        subfolder = '/'
        if input_dir is None:
            dir_list = os.listdir(config_url_Refs() + subfolder)
            input_dir = config_url_Refs()
        else:
            dir_list = os.listdir(input_dir + subfolder)
        list_of_files = []
        for item in dir_list:
            if not item.startswith('.'):
                # todo: why did they remove the extension?
                # list_of_files.append(os.path.splitext(item)[0])
                list_of_files.append(item)
    except:
        sys.stderr.write(traceback.format_exc())
        log(traceback.format_exc())
        log('*' * 50 + '\n')
        sys.exit(1)

    t1 = time.time()
    i = 1
    count = len(list_of_files)
    list_of_time = []

    for filename in list_of_files:
        print(">Segmenting:%s/%s:%s" % (i, count,filename))

        t11 = time.time()
        # path_layout = config_url_Layouts() + subfolder + filename + '.csv'
        path_refs = input_dir + subfolder + filename
        path_segs = config_url_Refs_segment() + subfolder + filename
        path_refs_and_bibtex = config_url_Refs_bibtex() + subfolder + filename + '.bib'
        path_segs_prob = config_url_Refs_segment_prob() + subfolder + filename + '.csv'
        path_segs_ditc = config_url_Refs_segment_dict() + subfolder + filename + '.csv'

        file = open(path_refs)
        reader = str(file.read())
        global lng
        lng = detect(reader)
        file.close()

        # txt, valid, _, ref_prob0 = ref_ext(reader)

        reader = re.sub(r'[\r\n]+', '\n', str(reader))
        reader = reader.split('\n')
        reader = reader[0:-1] if reader[-1] == '' else reader

        txt = []
        for row in reader:
            row = row.split('\t')
            txt.append(row[0])

        valid = [1] * len(txt)
        ref_prob0 = [(0, 1, 0, 0)] * len(txt)

        # refs = segment(txt, ref_prob0, valid)
        refs = list(range(0, len(txt)))
        reslt, refstr, retex = sg_ref(txt, refs, 2)

        # reslt: segmented references # refstr: refstr references # retex: bibtex
        #print ('Number of references: ' + str(len(refstr)))
        # create references file
        # wf = open(path_refs, 'w')
        # for item in refstr:
        #     wf.write("%s\n" % item)

        # create refs_seg file
        wf = open(path_segs, 'w')
        for item in reslt:
            wf.write("%s\n" % item)
        # create ref_bib file
        wf = open(path_refs_and_bibtex, 'w')
        wf_ref_and_bib = open(path_refs_and_bibtex, 'w')
        j = 0
        for item in retex:
            wf.write("%s\n" % item)
            data = {}
            data["ref_bib"] = item
            ref_text_x = refstr[j]
            data["ref_text_x"] = ref_text_x
            json_dict = json.dumps(data, ensure_ascii=False)
            wf_ref_and_bib.write("%s\n" % json_dict)
            j += 1
        # create ref_seg_prob_file, ref_dict_file, ref_gws_file
        reslt, refstr, retex = sg_ref(txt, refs, 1)
        # reslt: ref_seg_prob
        wf_seg_prob = open(path_segs_prob, 'w')
        wf_ref_dic = open(path_segs_ditc, 'w')
        len_of_ref_list = len(refstr)
        j = 0
        for item in reslt:
            wf_seg_prob.write("%s\n" % item)
            data = {}
            ref_seg_dic = createJson(item)
            data["ref_seg_dic"] = json.loads(ref_seg_dic)
            ref_text_x = refstr[j]
            data["ref_text_x"] = ref_text_x
            json_dict = json.dumps(data, ensure_ascii=False)
            wf_ref_dic.write("%s\n" % json_dict)
            j += 1
        log('Segmentation is done for: ' + filename)
        i += 1
        t22 = time.time()
        temp = t22 - t11
        list_of_time.append(temp)
    t2 = time.time()
    log('Sum time: %s' % (t2 - t1))
    if len(list_of_time) > 0:
        log('Average time: %s' % (sum(list_of_time) / float(len(list_of_time))))

