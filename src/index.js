import Connection from './Connection.js';
import C from './constants.js';

const DIMSE = {
  connection: new Connection({
    vr: {
      split: false
    }
  })
};

const conn = DIMSE.connection;

DIMSE.associate = function (contexts, callback, options) {
  const defaults = {
    contexts
  };

  options = Object.assign(defaults, options);

  console.info('Associating...');

  const socket = conn.associate(options, function (pdu) {
    // Associated
    console.info('==Associated');
    callback.call(this, null, pdu);
  });

  socket.on('error', function (error) {
    callback(error, null);
  });

  socket.on('timeout', function (error) {
    callback(error, null);
  });
};

DIMSE.retrievePatients = function (params, options) {
  return new Promise((resolve) => {
    DIMSE.associate([C.SOP_PATIENT_ROOT_FIND], function (error, pdu) {
      if (error) {
        console.error('Could not retrieve patients');
        console.trace();

        return resolve([]);
      }

      const defaultParams = {
        0x00100010: '',
        0x00100020: '',
        0x00100030: '',
        0x00100040: '',
        0x00101010: '',
        0x00101040: ''
      };

      const result = this.findPatients(Object.assign(defaultParams, params));
      const self = this;
      const patients = [];

      result.on('result', function (msg) {
        patients.push(msg);
      });

      result.on('end', function () {
        self.release();
      });

      this.on('close', function () {
        // Time = new Date() - start;console.log(time + 'ms taken');
        resolve(patients);
      });
    }, options);
  });
};

DIMSE.retrieveStudies = function (params, options) {
  // Start = new Date();
  return new Promise((resolve, reject) => {
    DIMSE.associate([C.SOP_STUDY_ROOT_FIND], function (error, pdu) {
      if (error) {
        console.error('Could not retrieve studies');
        console.trace();

        return reject(error);
      }

      const defaultParams = {
        0x0020000D: '',
        0x00080060: '',
        0x00080005: '',
        0x00080020: '',
        0x00080030: '',
        0x00080090: '',
        0x00100010: '',
        0x00100020: '',
        0x00200010: '',
        0x00100030: ''
      };

      const result = this.findStudies(Object.assign(defaultParams, params));
      const studies = [];
      const self = this;

      result.on('result', function (msg) {
        studies.push(msg);
      });

      result.on('end', function () {
        self.release();
      });

      this.on('close', function () {
        // Time = new Date() - start;console.log(time + 'ms taken');
        resolve(studies);
      });
    }, options);
  });
};

DIMSE._retrieveInstancesBySeries = function (conn, series, studyInstanceUID, callback, params) {
  const aSeries = series.shift();
  const seriesInstanceUID = aSeries.getValue(0x0020000E);
  const defaultParams = getInstanceRetrievalParams(studyInstanceUID, seriesInstanceUID);
  const result = conn.findInstances(Object.assign(defaultParams, params));
  const instances = [];

  result.on('result', function (msg) {
    instances.push(msg);
  });
  result.on('end', function () {
    if (series.length > 0) {
      callback(instances, false);
      DIMSE._retrieveInstancesBySeries(conn, series, studyInstanceUID, callback, params);
    } else {
      callback(instances, true);
    }
  });
};

DIMSE.retrieveInstancesByStudyOnlyMulti = function (studyInstanceUID, params, options) {
  if (!studyInstanceUID) {
    return [];
  }

  const series = DIMSE.retrieveSeries(studyInstanceUID, params, options);
  let instances = [];

  series.forEach(function (seriesData) {
    const seriesInstanceUID = seriesData.getValue(0x0020000E);
    const relatedInstances = DIMSE.retrieveInstances(studyInstanceUID, seriesInstanceUID, params, options);

    instances = instances.concat(relatedInstances);
  });

  return instances;
};

DIMSE.retrieveInstancesByStudyOnly = function (studyInstanceUID, params, options) {
  if (!studyInstanceUID) {
    return Promise.resolve([]);
  }

  return new Promise((resolve, reject) => {
    DIMSE.associate([C.SOP_STUDY_ROOT_FIND], function (error, pdu) {
      if (error) {
        console.error('Could not retrieve Instances By Study');
        console.trace();

        return reject(error);
      }

      const defaultParams = {
        0x0020000D: studyInstanceUID,
        0x00080005: '',
        0x00080020: '',
        0x00080030: '',
        0x00080090: '',
        0x00100010: '',
        0x00100020: '',
        0x00200010: '',
        0x0008103E: '',
        0x0020000E: '',
        0x00200011: ''
      };
      const result = this.findSeries(Object.assign(defaultParams, params));
      const series = [];
      const conn = this;
      let allInstances = [];

      result.on('result', function (msg) {
        series.push(msg);
      });
      result.on('end', function () {
        if (series.length > 0) {
          DIMSE._retrieveInstancesBySeries(conn, series, studyInstanceUID, function (relatedInstances, isEnd) {
            allInstances = allInstances.concat(relatedInstances);
            if (isEnd) {
              conn.release();
            }
          });
        } else {
          conn.release();
        }
      });
      conn.on('close', function () {
        resolve(allInstances);
      });
    });
  });
};

DIMSE.retrieveSeries = function (studyInstanceUID, params, options) {
  return new Promise((resolve) => {
    DIMSE.associate([C.SOP_STUDY_ROOT_FIND], function (error, pdu) {
      if (error) {
        console.error('Could not retrieve series');
        console.trace();

        return resolve([]);
      }

      const defaultParams = {
        0x0020000D: studyInstanceUID ? studyInstanceUID : '',
        0x00080005: '',
        0x00080020: '',
        0x00080030: '',
        0x00080090: '',
        0x00100010: '',
        0x00100020: '',
        0x00200010: '',
        0x0008103E: '',
        0x0020000E: '',
        0x00200011: ''
      };

      const result = this.findSeries(Object.assign(defaultParams, params));
      const self = this;
      const series = [];

      result.on('result', function (msg) {
        series.push(msg);
      });

      result.on('end', function () {
        self.release();
      });

      this.on('close', function () {
        resolve(series);
      });
    }, options);
  });
};

DIMSE.retrieveInstances = function (studyInstanceUID, seriesInstanceUID, params, options) {
  return new Promise((resolve, reject) => {
    DIMSE.associate([C.SOP_STUDY_ROOT_FIND], function (error, pdu) {
      if (error) {
        console.error('Could not retrieve instances');
        console.trace();

        return reject(error);
      }

      const defaultParams = getInstanceRetrievalParams(studyInstanceUID, seriesInstanceUID);
      const result = this.findInstances(Object.assign(defaultParams, params));
      const self = this;

      const instances = [];

      result.on('result', function (msg) {
        instances.push(msg);
      });

      result.on('end', function () {
        self.release();
      });

      this.on('close', function () {
        resolve(instances);
      });
    }, options);
  });
};

DIMSE.storeInstances = function (fileList, callback) {
  const handle = conn.storeInstances(fileList);

  handle.on('file', function (err, file) {
    callback(err, file);
  });
};

DIMSE.moveInstances = function (studyInstanceUID, seriesInstanceUID, sopInstanceUID, sopClassUID, params) {
  DIMSE.associate([C.SOP_STUDY_ROOT_MOVE, sopClassUID], function (error) {
    if (error) {
      console.error('Could not move instances');
      console.trace();

      return;
    }

    const defaultParams = {
      0x0020000D: studyInstanceUID ? studyInstanceUID : '',
      0x0020000E: seriesInstanceUID ? seriesInstanceUID : '',
      0x00080018: sopInstanceUID ? sopInstanceUID : ''
    };

    this.moveInstances('OHIFDCM', Object.assign(defaultParams, params));
  });
};

const getInstanceRetrievalParams = (studyInstanceUID, seriesInstanceUID) => ({
  0x0020000D: studyInstanceUID ? studyInstanceUID : '',
  0x0020000E: (studyInstanceUID && seriesInstanceUID) ? seriesInstanceUID : '',
  0x00080005: '', // SpecificCharacterSet
  0x00080020: '', // StudyDate
  0x00080030: '', // StudyDescription
  0x00080090: '', // ReferringPhysicianName
  0x00100010: '', // PatientName
  0x00100020: '', // PatientId
  0x00100030: '', // PatientBirthDate
  0x00100040: '', // PatientSex
  0x00200010: '', // StudyId
  0x0008103E: '', // SeriesDescription
  0x00200011: '', // SeriesNumber
  0x00080080: '', // InstitutionName
  0x00080016: '', // SopClassUid
  0x00080018: '', // SopInstanceUid
  0x00080060: '', // Modality
  0x00200013: '', // InstanceNumber
  0x00280010: '', // Rows
  0x00280011: '', // Columns
  0x00280100: '', // BitsAllocated
  0x00280101: '', // BitsStored
  0x00280102: '', // HighBit
  0x00280103: '', // PixelRepresentation
  0x00280004: '', // PhotometricInterpretation
  0x0008002A: '', // AcquisitionDatetime
  0x00280008: '', // NumFrames
  // 0x00280009: '', // frameIncrementPointer // This appears to be breaking Orthanc DIMSE connections
  0x00181063: '', // FrameTime
  0x00181065: '', // FrameTimeVector
  0x00281052: '', // RescaleIntercept
  0x00281053: '', // RescaleSlope
  0x00280002: '', // SamplesPerPixel
  0x00180050: '', // SliceThickness
  0x00201041: '', // SliceLocation
  // 0x00189327: '', // tablePosition // This appears to be breaking Orthanc DIMSE connections
  0x00281050: '', // WindowCenter
  0x00281051: '', // WindowWidth
  0x00280030: '', // PixelSpacing
  0x00200062: '', // Laterality
  0x00185101: '', // ViewPosition
  0x00080008: '', // ImageType
  0x00200032: '', // ImagePositionPatient
  0x00200037: '', // ImageOrientationPatient
  0x00200052: '', // FrameOfReferenceUID
  0x00282110: '', // LossyImageCompression
  0x00282112: '', // LossyImageCompressionRatio
  0x00282114: '', // LossyImageCompressionMethod,
  0x00180088: '' // SpacingBetweenSlices

  // Orthanc has a bug here so we can't retrieve sequences at the moment
  // https://groups.google.com/forum/#!topic/orthanc-users/ghKJfvtnK8Y
  // 0x00282111: '', // derivationDescription
  // 0x00082112: ''  // sourceImageSequence
});

export default DIMSE;
